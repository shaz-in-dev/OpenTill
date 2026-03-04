
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
