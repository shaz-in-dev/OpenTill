-- Fix Critical Bugs: Double KDS Tickets + Secure Pricing (Combined)

-- 1. Drop old function
DROP FUNCTION IF EXISTS sell_items(jsonb);

-- 2. Re-create the secure 'sell_items' RPC with KDS Skip Logic
CREATE OR REPLACE FUNCTION sell_items(order_payload jsonb)
RETURNS jsonb AS $$
DECLARE
  new_order_id uuid;
  item_record jsonb;
  order_total numeric := 0; -- Start at 0, calculate from DB
  calculated_item_price numeric;
  v_payment_method text;
  v_card_code text;
  v_branch_id uuid;
BEGIN
  v_payment_method := order_payload->>'paymentMethod';
  v_branch_id := (order_payload->>'branchId')::uuid;

  -- ---------------------------------------------------------
  -- 1. SERVER-SIDE PRICE CALCULATION (Secure)
  -- ---------------------------------------------------------
  FOR item_record IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
      IF (item_record->>'id') IS NOT NULL AND (item_record->>'id') != '' THEN
          -- Lookup the real price from the database (variants table)
          SELECT price INTO calculated_item_price 
          FROM variants 
          WHERE id = (item_record->>'id')::uuid;
          
          -- Add to total (Price * Quantity)
          -- Use COALESCE to handle deleted variants gracefully (or 0)
          order_total := order_total + (COALESCE(calculated_item_price, 0) * (item_record->>'quantity')::int);
      ELSE
          -- Fallback for custom/unlinked items (if you allow them)
          -- This still trusts client for custom items, but prevents manipulation of catalog items
          order_total := order_total + ((item_record->>'price')::numeric * (item_record->>'quantity')::int);
      END IF;
  END LOOP;

  -- ---------------------------------------------------------
  -- A. Gift Card Payment Logic
  -- ---------------------------------------------------------
  IF v_payment_method LIKE 'GIFT_CARD%' THEN
     v_card_code := order_payload->>'giftCardCode';
     
     -- Check balance against CALCULATED total
     UPDATE gift_cards
     SET balance = balance - (order_total / 100.0), last_used = NOW()
     WHERE code = v_card_code AND balance >= (order_total / 100.0);
     
     IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient gift card balance or invalid card';
     END IF;
     
     INSERT INTO gift_card_transactions (card_code, amount, transaction_type)
     VALUES (v_card_code, -(order_total / 100.0), 'PURCHASE');
  END IF;

  -- ---------------------------------------------------------
  -- B. Create Order (Using Secure Total)
  -- ---------------------------------------------------------
  INSERT INTO orders (
    total_amount, payment_method, status, branch_id, customer_name, table_number
  ) VALUES (
    order_total, -- SECURE SERVER-SIDE TOTAL
    v_payment_method,
    'COMPLETED',
    v_branch_id,
    order_payload->>'customerName',
    order_payload->>'tableNumber'
  ) RETURNING id INTO new_order_id;

  -- ---------------------------------------------------------
  -- C. Process Items (Stock & Order Items)
  -- ---------------------------------------------------------
  FOR item_record IN SELECT * FROM jsonb_array_elements(order_payload->'items')
  LOOP
    -- Deduct Stock (only if ID is valid)
    IF (item_record->>'id') IS NOT NULL AND (item_record->>'id') != '' THEN
        UPDATE branch_product_stock
        SET stock_quantity = stock_quantity - (item_record->>'quantity')::int
        WHERE variant_id = (item_record->>'id')::uuid AND branch_id = v_branch_id;
    END IF;

    -- Insert Order Item
    INSERT INTO order_items (
      order_id, variant_id, product_name_snapshot, quantity, price_at_sale, modifiers, branch_id
    ) VALUES (
      new_order_id,
      CASE WHEN (item_record->>'id') = '' OR (item_record->>'id') IS NULL THEN NULL ELSE (item_record->>'id')::uuid END,
      item_record->>'name',
      (item_record->>'quantity')::int,
      (item_record->>'price')::int, 
      COALESCE(item_record->'modifiers', '[]'::jsonb),
      v_branch_id
    );
  END LOOP;
  
  -- ---------------------------------------------------------
  -- D. Create Kitchen Ticket (Automated KDS) - CONDITIONAL
  -- ---------------------------------------------------------
  -- ONLY create ticket if 'skipKds' is FALSE or NULL.
  IF NOT COALESCE((order_payload->>'skipKds')::boolean, false) THEN
      INSERT INTO kitchen_tickets (table_number, items, status, branch_id, created_at)
      VALUES (
        COALESCE(order_payload->>'tableNumber', 'Walk-In'),
        order_payload->'items',
        'PENDING',
        v_branch_id,
        NOW()
      );
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', new_order_id);
END;
$$ LANGUAGE plpgsql;