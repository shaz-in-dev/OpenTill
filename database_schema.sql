-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.areas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  capacity integer DEFAULT 0,
  is_active boolean DEFAULT true,
  CONSTRAINT areas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booking_settings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  interval_minutes integer DEFAULT 15,
  max_covers_per_interval integer DEFAULT 20,
  default_turn_time integer DEFAULT 15,
  duration_rules jsonb DEFAULT '{"2": 90, "4": 105, "6": 120, "10": 150}'::jsonb,
  CONSTRAINT booking_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  customer_name text NOT NULL,
  booking_time timestamp with time zone NOT NULL,
  guests integer DEFAULT 2,
  phone text,
  table_number text,
  status text DEFAULT 'confirmed'::text,
  customer_phone text,
  customer_email text,
  customer_tags jsonb DEFAULT '[]'::jsonb,
  duration_minutes integer DEFAULT 90,
  turn_time_minutes integer DEFAULT 15,
  party_size integer DEFAULT 2,
  booking_source text DEFAULT 'WALK_IN'::text,
  table_id bigint,
  expected_end_time timestamp with time zone,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.dining_tables(id)
);
CREATE TABLE public.branch_ingredient_stock (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid,
  ingredient_id uuid,
  current_stock numeric DEFAULT 0,
  low_stock_threshold numeric DEFAULT 5,
  CONSTRAINT branch_ingredient_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_ingredient_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_ingredient_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);
CREATE TABLE public.branch_product_stock (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid,
  variant_id uuid,
  stock_quantity integer DEFAULT 0,
  CONSTRAINT branch_product_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_product_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_product_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  org_id uuid,
  name text NOT NULL,
  address text,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  loyalty_points integer DEFAULT 0,
  total_spend bigint DEFAULT 0,
  last_visit timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dining_tables (
  id integer NOT NULL DEFAULT nextval('dining_tables_id_seq'::regclass),
  table_number text NOT NULL UNIQUE,
  status text DEFAULT 'AVAILABLE'::text CHECK (status = ANY (ARRAY['AVAILABLE'::text, 'OCCUPIED'::text, 'RESERVED'::text])),
  current_order_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  branch_id uuid DEFAULT 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf'::uuid,
  area_id bigint,
  min_covers integer DEFAULT 2,
  max_covers integer DEFAULT 4,
  is_combinable boolean DEFAULT false,
  CONSTRAINT dining_tables_pkey PRIMARY KEY (id),
  CONSTRAINT dining_tables_current_order_id_fkey FOREIGN KEY (current_order_id) REFERENCES public.orders(id),
  CONSTRAINT dining_tables_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT dining_tables_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);
CREATE TABLE public.gift_card_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  card_code text,
  amount numeric NOT NULL,
  transaction_type text NOT NULL,
  order_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gift_card_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT gift_card_transactions_card_code_fkey FOREIGN KEY (card_code) REFERENCES public.gift_cards(code)
);
CREATE TABLE public.gift_cards (
  code text NOT NULL,
  balance numeric DEFAULT 0 CHECK (balance >= 0::numeric),
  status text DEFAULT 'ACTIVE'::text,
  created_at timestamp with time zone DEFAULT now(),
  expiry_date timestamp with time zone,
  CONSTRAINT gift_cards_pkey PRIMARY KEY (code)
);
CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  unit text DEFAULT 'kg'::text,
  cost_per_unit numeric DEFAULT 0,
  current_stock numeric DEFAULT 0,
  low_stock_threshold numeric DEFAULT 5,
  created_at timestamp with time zone DEFAULT now(),
  org_id uuid DEFAULT 'c00c74bb-ff22-4cb0-a361-ac6dbb1daa31'::uuid,
  CONSTRAINT ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT ingredients_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.kitchen_tickets (
  id integer NOT NULL DEFAULT nextval('kitchen_tickets_id_seq'::regclass),
  table_number text NOT NULL,
  items jsonb NOT NULL,
  status text DEFAULT 'PENDING'::text,
  created_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  branch_id uuid DEFAULT 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf'::uuid,
  CONSTRAINT kitchen_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT kitchen_tickets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.modifier_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid,
  name text NOT NULL,
  min_selection integer DEFAULT 0,
  max_selection integer DEFAULT 1,
  required boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT modifier_groups_pkey PRIMARY KEY (id),
  CONSTRAINT modifier_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.modifiers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid,
  name text NOT NULL,
  price_adjustment integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT modifiers_pkey PRIMARY KEY (id),
  CONSTRAINT modifiers_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.modifier_groups(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  variant_id uuid,
  product_name_snapshot text,
  quantity integer DEFAULT 1,
  price_at_sale integer NOT NULL,
  modifiers jsonb DEFAULT '[]'::jsonb,
  branch_id uuid DEFAULT 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf'::uuid,
  cost_at_sale numeric DEFAULT 0,
  tax_amount_at_sale numeric DEFAULT 0,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id),
  CONSTRAINT order_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  status text DEFAULT 'PENDING'::text,
  total_amount integer NOT NULL DEFAULT 0,
  payment_method text,
  device_id text,
  branch_id uuid DEFAULT 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf'::uuid,
  customer_id uuid,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  owner_id uuid,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.product_ingredients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  variant_id uuid,
  ingredient_id uuid,
  quantity_required numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT product_ingredients_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id),
  CONSTRAINT product_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  image_url text,
  tax_rate numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  org_id uuid DEFAULT 'c00c74bb-ff22-4cb0-a361-ac6dbb1daa31'::uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  po_id uuid,
  ingredient_id uuid,
  quantity_ordered numeric NOT NULL,
  cost_per_unit numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_order_items_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid,
  supplier_id uuid,
  status text DEFAULT 'DRAFT'::text,
  total_cost numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  received_at timestamp with time zone,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  staff_name text,
  clock_in timestamp with time zone DEFAULT now(),
  clock_out timestamp with time zone,
  hourly_rate numeric,
  total_pay numeric,
  status text DEFAULT 'ACTIVE'::text,
  CONSTRAINT shifts_pkey PRIMARY KEY (id),
  CONSTRAINT shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.staff_directory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  first_name text,
  last_name text,
  email text,
  role text DEFAULT 'cashier'::text,
  branch_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_directory_pkey PRIMARY KEY (id),
  CONSTRAINT staff_directory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  org_id uuid,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  currency text DEFAULT 'USD'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.table_cart_items (
  id integer NOT NULL DEFAULT nextval('table_cart_items_id_seq'::regclass),
  table_number text NOT NULL,
  variant_id uuid NOT NULL,
  product_name text NOT NULL,
  price_at_addition integer NOT NULL,
  quantity integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'DRAFT'::text CHECK (status = ANY (ARRAY['DRAFT'::text, 'SENT'::text, 'VOIDED'::text])),
  modifiers jsonb DEFAULT '[]'::jsonb,
  branch_id uuid DEFAULT 'a798abd7-2ab8-4419-8bb6-d77bd584a2bf'::uuid,
  CONSTRAINT table_cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT table_cart_items_table_number_fkey FOREIGN KEY (table_number) REFERENCES public.dining_tables(table_number),
  CONSTRAINT table_cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id),
  CONSTRAINT table_cart_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  name text NOT NULL,
  sku text,
  price integer NOT NULL,
  stock_count integer DEFAULT 0,
  stock_quantity integer DEFAULT 0,
  track_stock boolean DEFAULT false,
  org_id uuid DEFAULT 'c00c74bb-ff22-4cb0-a361-ac6dbb1daa31'::uuid,
  CONSTRAINT variants_pkey PRIMARY KEY (id),
  CONSTRAINT variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT variants_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  customer_name text NOT NULL,
  contact_info text,
  party_size integer NOT NULL,
  quoted_wait_time integer,
  status text DEFAULT 'WAITING'::text,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);
CREATE TABLE public.wastage_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  ingredient_id uuid,
  quantity_wasted numeric NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wastage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT wastage_logs_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);
