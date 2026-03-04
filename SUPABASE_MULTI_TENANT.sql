-- 1. Create Tenant Hierarchy Notes (Organization & Branches)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID REFERENCES auth.users(id) -- The user who owns the account
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Default Data for Existing User (Migration Step)
-- (We use a DO block to ensure we only insert if empty, preserving existing data as "Branch 1")
DO $$ 
DECLARE 
  default_org_id UUID;
  default_branch_id UUID;
BEGIN
  -- Create a default Org if none exists
  IF NOT EXISTS (SELECT 1 FROM organizations) THEN
    INSERT INTO organizations (name) VALUES ('My Organization') RETURNING id INTO default_org_id;
  ELSE
    SELECT id INTO default_org_id FROM organizations LIMIT 1;
  END IF;

  -- Create a default Branch if none exists
  IF NOT EXISTS (SELECT 1 FROM branches) THEN
    INSERT INTO branches (org_id, name, address) VALUES (default_org_id, 'Main Branch', 'HQ') RETURNING id INTO default_branch_id;
  ELSE
    SELECT id INTO default_branch_id FROM branches LIMIT 1;
  END IF;

  -- 3. Add Context Columns to Existing Tables (Defaulting to the generated IDs)
  -- We use dynamic SQL (EXECUTE format) because DDL statements like ALTER TABLE cannot 
  -- accept PL/pgSQL variables directly in the DEFAULT clause.

  -- Products & Variants are Org-Level (Shared Menu)
  EXECUTE format('ALTER TABLE products ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) DEFAULT %L', default_org_id);
  EXECUTE format('ALTER TABLE variants ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) DEFAULT %L', default_org_id);

  -- Ingredients are Org-Level (Shared Definitions)
  EXECUTE format('ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) DEFAULT %L', default_org_id);

  -- Operational Transactional Data is Branch-Level
  EXECUTE format('ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT %L', default_branch_id);
  EXECUTE format('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT %L', default_branch_id);
  EXECUTE format('ALTER TABLE kitchen_tickets ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT %L', default_branch_id);
  EXECUTE format('ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT %L', default_branch_id);
  EXECUTE format('ALTER TABLE table_cart_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT %L', default_branch_id);
  
  -- Users need to be linked to an Org
  EXECUTE format('ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) DEFAULT %L', default_org_id);
  -- Users might be restricted to a specific branch (if NULL, they are Org Admin)
  ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id); 

  -- 4. SPLIT INVENTORY (The "ERP" Part)
  -- Create tables to hold STOCK separate from DEFINITIONS
  
  -- Tracking Ingredient Stock per Branch
  CREATE TABLE IF NOT EXISTS branch_ingredient_stock (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    current_stock NUMERIC DEFAULT 0,
    low_stock_threshold NUMERIC DEFAULT 5,
    UNIQUE(branch_id, ingredient_id)
  );

  -- Migrate existing ingredient stock to the default branch
  INSERT INTO branch_ingredient_stock (branch_id, ingredient_id, current_stock, low_stock_threshold)
  SELECT default_branch_id, id, current_stock, low_stock_threshold FROM ingredients
  ON CONFLICT DO NOTHING;

  -- Tracking Product (Retail) Stock per Branch
  CREATE TABLE IF NOT EXISTS branch_product_stock (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
    stock_quantity INTEGER DEFAULT 0,
    UNIQUE(branch_id, variant_id)
  );

  -- Migrate existing product stock to the default branch
  INSERT INTO branch_product_stock (branch_id, variant_id, stock_quantity)
  SELECT default_branch_id, id, stock_quantity FROM variants WHERE track_stock = true
  ON CONFLICT DO NOTHING;

END $$;

-- 5. Updated "Sell Items" Function to use Branch Logic
-- We need to drop the old one first because the signature might change or logic significantly differs
DROP FUNCTION IF EXISTS sell_items;

CREATE OR REPLACE FUNCTION sell_items(order_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  total_amt INTEGER;
  pay_method TEXT;
  target_branch_id UUID;
BEGIN
  total_amt := (order_payload->>'totalAmount')::INTEGER;
  pay_method := order_payload->>'paymentMethod';
  
  -- Assume branch_id is passed in payload, or fallback to the first branch found for user (Simplification for now)
  -- Real ERPs would pass branch_id from the frontend context.
  target_branch_id := (order_payload->>'branchId')::UUID;
  
  -- Create Order
  INSERT INTO orders (total_amount, payment_method, status, branch_id)
  VALUES (total_amt, pay_method, 'COMPLETED', target_branch_id)
  RETURNING id INTO new_order_id;
  
  -- Insert Items
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id, 
      branch_id,
      variant_id, 
      product_name_snapshot, 
      quantity, 
      price_at_sale, 
      modifiers
    )
    VALUES (
      new_order_id,
      target_branch_id,
      (item->>'id')::UUID,
      item->>'name',
      (item->>'quantity')::INTEGER,
      (item->>'price')::INTEGER,
      COALESCE(item->'modifiers', '[]'::jsonb)
    );
    
    -- Stock Deduction (New: Uses branch_product_stock instead of variants table)
    UPDATE branch_product_stock 
    SET stock_quantity = stock_quantity - (item->>'quantity')::INTEGER
    WHERE variant_id = (item->>'id')::UUID AND branch_id = target_branch_id;
    
  END LOOP;
  
  RETURN json_build_object('order_id', new_order_id, 'status', 'success');
END;
$$;