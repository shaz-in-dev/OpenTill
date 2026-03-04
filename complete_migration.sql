-- Extension: Ensure UUID generation is available
create extension if not exists "uuid-ossp";

--------------------------------------------------------------------------------
-- SECTION 1: CRM & LOYALTY
--------------------------------------------------------------------------------

-- Customers Table
create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text unique,
  phone text,
  loyalty_points int default 0,
  total_spend bigint default 0, -- Stored in cents
  last_visit timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Link orders to customers if not already
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'customer_id') then
        alter table orders add column customer_id uuid references customers(id);
    end if;
end $$;

-- CRM Settings
-- Add 'crm_enabled' setting if it doesn't exist
insert into settings (key, value)
select 'crm_enabled', 'false'
where not exists (select 1 from settings where key = 'crm_enabled');

-- Add 'crm_loyalty_points_per_unit' setting
insert into settings (key, value)
select 'crm_loyalty_points_per_unit', '10'
where not exists (select 1 from settings where key = 'crm_loyalty_points_per_unit');


--------------------------------------------------------------------------------
-- SECTION 2: STAFF MANAGEMENT (SHIFTS)
--------------------------------------------------------------------------------

create table if not exists shifts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id), 
  staff_name text, -- Snapshot of name/email for easier display
  clock_in timestamp with time zone default now(),
  clock_out timestamp with time zone,
  hourly_rate numeric, -- Snapshot of rate at time of shift
  total_pay numeric, -- Calculated on clock out
  status text default 'ACTIVE' -- ACTIVE, COMPLETED
);


--------------------------------------------------------------------------------
-- SECTION 3: REPLENISHMENT (PURCHASE ORDERS)
--------------------------------------------------------------------------------

-- 1. Suppliers Table
create table if not exists suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default now()
);

-- 2. Purchase Orders Table
create table if not exists purchase_orders (
  id uuid default uuid_generate_v4() primary key,
  supplier_id uuid references suppliers(id),
  branch_id uuid, -- For multi-branch support
  status text default 'DRAFT', -- DRAFT, ORDERED, RECEIVED, CANCELLED
  total_cost numeric,
  created_at timestamp with time zone default now(),
  received_at timestamp with time zone
);

-- 3. PO Items Table
create table if not exists purchase_order_items (
  id uuid default uuid_generate_v4() primary key,
  po_id uuid references purchase_orders(id) on delete cascade,
  ingredient_id uuid references ingredients(id), -- Assumes ingredients table exists
  quantity_ordered numeric not null,
  cost_per_unit numeric,
  created_at timestamp with time zone default now()
);

-- Ensure ingredients table exists (basic version if not)
create table if not exists ingredients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  unit text,
  current_stock numeric default 0,
  cost_per_unit numeric default 0
);

-- Safely add columns if table exists but columns do not
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='ingredients' and column_name='cost_per_unit') then
    alter table ingredients add column cost_per_unit numeric default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ingredients' and column_name='current_stock') then
    alter table ingredients add column current_stock numeric default 0;
  end if;
end $$;

-- 4. RPC to Receive Order and Update Stock
drop function if exists receive_purchase_order(uuid);

create or replace function receive_purchase_order(po_id_input uuid)
returns void as $$
declare
  item record;
  current_status text;
begin
  -- Check if order is already received
  select status into current_status from purchase_orders where id = po_id_input;
  if current_status = 'RECEIVED' then
    return;
  end if;

  -- Loop through items in the PO
  for item in select * from purchase_order_items where po_id = po_id_input loop
    -- Update ingredient stock
    update ingredients
    set current_stock = coalesce(current_stock, 0) + item.quantity_ordered,
        cost_per_unit = item.cost_per_unit -- Update last cost
    where id = item.ingredient_id;
  end loop;

  -- Update PO status
  update purchase_orders
  set status = 'RECEIVED',
      received_at = now()
  where id = po_id_input;
end;
$$ language plpgsql;


--------------------------------------------------------------------------------
-- SECTION 4: GIFT CARDS
--------------------------------------------------------------------------------

-- 1. Gift Cards Table
create table if not exists gift_cards (
  code text primary key, -- The unique card code (e.g., GC-1234-5678)
  balance numeric default 0 check (balance >= 0),
  status text default 'ACTIVE', -- ACTIVE, DISABLED, EXPIRED
  created_at timestamp with time zone default now(),
  expiry_date timestamp with time zone
);

-- 2. Transaction Log for Audit Trail
create table if not exists gift_card_transactions (
  id uuid default uuid_generate_v4() primary key,
  card_code text references gift_cards(code),
  amount numeric not null, -- Positive for load, negative for spend
  transaction_type text not null, -- 'ISSUE', 'REDEEM', 'REFUND'
  order_id text, -- Optional reference to an order, if applicable
  created_at timestamp with time zone default now()
);

-- 3. RPC to Process Payment with Gift Card
create or replace function process_gift_card_payment(card_code_input text, amount_input numeric, order_id_input text)
returns boolean as $$
declare
  current_bal numeric;
  card_status text;
begin
  -- Check card existence and status
  select balance, status into current_bal, card_status 
  from gift_cards where code = card_code_input;

  if not found then
    raise exception 'Invalid Gift Card Code';
  end if;

  if card_status <> 'ACTIVE' then
    raise exception 'Gift Card is not active';
  end if;

  if current_bal < amount_input then
    raise exception 'Insufficient Balance';
  end if;

  -- Deduct Balance
  update gift_cards 
  set balance = balance - amount_input 
  where code = card_code_input;

  -- Log Transaction
  insert into gift_card_transactions (card_code, amount, transaction_type, order_id)
  values (card_code_input, -amount_input, 'REDEEM', order_id_input);

  return true;
end;
$$ language plpgsql;

-- 4. RPC to Increment Balance (Recharge)
create or replace function increment_gift_card_balance(card_code_input text, amount_input numeric)
returns void as $$
begin
  update gift_cards 
  set balance = balance + amount_input 
  where code = card_code_input;
end;
$$ language plpgsql;
