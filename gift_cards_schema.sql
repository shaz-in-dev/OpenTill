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
