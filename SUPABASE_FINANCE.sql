
-- Run this in your Supabase SQL Editor to add Finance & Procurement Layers

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Purchase Orders (Procurement)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'DRAFT', -- DRAFT, ORDERED, RECEIVED, CANCELLED
  total_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id),
  quantity_ordered NUMERIC NOT NULL,
  cost_per_unit NUMERIC NOT NULL, -- Captures standard cost at time of purchase
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tax Rate per Product (for Multi-Region Tax)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0; -- Percentage (e.g., 20.0 for 20%)

-- 4. Cost Tracking on Sales (COGS Snapshot)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_amount_at_sale NUMERIC DEFAULT 0;

-- 5. Function to Receive Stock from Suppliers
-- This updates inventory counts and updates the Ingredient Cost Price (Last Purchase Price method)
CREATE OR REPLACE FUNCTION receive_purchase_order(po_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  po_record RECORD;
  item_record RECORD;
BEGIN
  -- Get PO
  SELECT * INTO po_record FROM purchase_orders WHERE id = po_id_input;

  IF po_record IS NULL THEN
     RETURN json_build_object('status', 'error', 'message', 'PO not found');
  END IF;

  IF po_record.status = 'RECEIVED' THEN
    RETURN json_build_object('status', 'error', 'message', 'Already received');
  END IF;

  -- Loop through items
  FOR item_record IN SELECT * FROM purchase_order_items WHERE po_id = po_id_input
  LOOP
    -- Update Branch Stock (Upsert)
    INSERT INTO branch_ingredient_stock (branch_id, ingredient_id, current_stock)
    VALUES (po_record.branch_id, item_record.ingredient_id, item_record.quantity_ordered)
    ON CONFLICT (branch_id, ingredient_id) 
    DO UPDATE SET current_stock = branch_ingredient_stock.current_stock + EXCLUDED.current_stock;

    -- Update Global Ingredient Cost
    UPDATE ingredients 
    SET cost_per_unit = item_record.cost_per_unit
    WHERE id = item_record.ingredient_id;
  END LOOP;

  -- Mark PO as Received
  UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW() WHERE id = po_id_input;

  RETURN json_build_object('status', 'success');
END;
$$;

-- 6. Updated Sell Items to calculate COGS dynamically
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
  
  -- COGS Vars
  item_id UUID;
  item_qty INTEGER;
  calculated_cogs NUMERIC;
  
  -- Record vars for loops must be declared
  pi_record RECORD; 
  
BEGIN
  total_amt := (order_payload->>'totalAmount')::INTEGER;
  pay_method := order_payload->>'paymentMethod';
  target_branch_id := (order_payload->>'branchId')::UUID;
  
  -- Create Order
  INSERT INTO orders (total_amount, payment_method, status, branch_id)
  VALUES (total_amt, pay_method, 'COMPLETED', target_branch_id)
  RETURNING id INTO new_order_id;
  
  -- Insert Items
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
    item_id := (item->>'id')::UUID;
    item_qty := (item->>'quantity')::INTEGER;
  
    -- Calculate COGS for this item
    calculated_cogs := 0;
    
    FOR pi_record IN 
        SELECT i.cost_per_unit, pi.quantity_required, pi.ingredient_id
        FROM product_ingredients pi
        JOIN ingredients i ON i.id = pi.ingredient_id
        WHERE pi.variant_id = item_id
    LOOP
        -- Calculate Cost
        calculated_cogs := calculated_cogs + (pi_record.cost_per_unit * pi_record.quantity_required);
        
        -- DEDUCT INGREDIENT STOCK (Backflushing)
        -- We try to deduct, but we need to match the specific branch_id from the order
        UPDATE branch_ingredient_stock 
        SET current_stock = current_stock - (pi_record.quantity_required * item_qty)
        WHERE ingredient_id = pi_record.ingredient_id 
          AND branch_id = target_branch_id;
          
    END LOOP;

    -- Insert Order Item with COGS Snapshot (in CENTS)
    -- We cast calculated_cogs (dollars) to cents by * 100
    INSERT INTO order_items (
      order_id, 
      branch_id, 
      variant_id, 
      product_name_snapshot, 
      quantity, 
      price_at_sale, 
      modifiers,
      cost_at_sale
    )
    VALUES (
      new_order_id,
      target_branch_id,
      item_id,
      item->>'name',
      item_qty,
      (item->>'price')::INTEGER,
      COALESCE(item->'modifiers', '[]'::jsonb),
      (calculated_cogs * 100)::INTEGER
    );
    
    -- DEDUCT RETAIL STOCK
    UPDATE branch_product_stock 
    SET stock_quantity = stock_quantity - item_qty
    WHERE variant_id = item_id AND branch_id = target_branch_id;
      
  END LOOP;
  
  RETURN json_build_object('order_id', new_order_id, 'status', 'success');
END;
$$;