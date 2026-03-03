-- Run this in your Supabase SQL Editor

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Modifier Groups
CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_selection INTEGER DEFAULT 0,
  max_selection INTEGER DEFAULT 1,
  required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Modifiers
CREATE TABLE IF NOT EXISTS modifiers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment INTEGER DEFAULT 0, -- in cents
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ingredients & Wastage (for Inventory Task)
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'kg',
  cost_per_unit NUMERIC DEFAULT 0,
  current_stock NUMERIC DEFAULT 0,
  low_stock_threshold NUMERIC DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_required NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wastage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  quantity_wasted NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add 'modifiers' column to existing tables for history
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE table_cart_items ADD COLUMN IF NOT EXISTS modifiers JSONB DEFAULT '[]'::jsonb;

-- 5. Updated/Safe 'sell_items' RPC to handle modifiers
CREATE OR REPLACE FUNCTION sell_items(order_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  new_order_id UUID;
  item JSONB;
  total_amt INTEGER;
  pay_method TEXT;
BEGIN
  total_amt := (order_payload->>'totalAmount')::INTEGER;
  pay_method := order_payload->>'paymentMethod';
  
  -- Create Order
  INSERT INTO orders (total_amount, payment_method, status)
  VALUES (total_amt, pay_method, 'COMPLETED')
  RETURNING id INTO new_order_id;
  
  -- Insert Items
  FOR item IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id, 
      variant_id, 
      product_name_snapshot, 
      quantity, 
      price_at_sale, 
      modifiers
    )
    VALUES (
      new_order_id,
      (item->>'id')::UUID,
      item->>'name',
      (item->>'quantity')::INTEGER,
      (item->>'price')::INTEGER,
      COALESCE(item->'modifiers', '[]'::jsonb)
    );
    
    -- Stock Deduction (Simple)
    UPDATE variants 
    SET stock_quantity = stock_quantity - (item->>'quantity')::INTEGER
    WHERE id = (item->>'id')::UUID AND track_stock = true;
    
  END LOOP;
  
  RETURN json_build_object('order_id', new_order_id, 'status', 'success');
END;
$$;
