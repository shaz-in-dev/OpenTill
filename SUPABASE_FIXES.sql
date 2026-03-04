-- FIX SCRIPT (Run this to fix previous errors)

-- 1. Fix 'settings' table type issue
-- The 'value' column was boolean, causing type errors. We drop and recreate it as JSONB.
DROP TABLE IF EXISTS settings;

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL
);

-- 2. Fix 'staff_directory' issue (It was a view, we need a table)
-- We drop the view and recreate it as a real table to store roles and user_ids
DROP VIEW IF EXISTS staff_directory CASCADE;

-- If staff_directory was already a table, recreate it just in case to add branch_id
CREATE TABLE IF NOT EXISTS staff_directory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'cashier', -- manager, cashier, cook
  branch_id UUID, -- For multi-tenant
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Re-apply RBAC Permissions
ALTER TABLE staff_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage all staff" ON staff_directory;
CREATE POLICY "Managers can manage all staff" ON staff_directory
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM staff_directory WHERE role = 'manager'
  )
);

DROP POLICY IF EXISTS "Staff can view own record" ON staff_directory;
CREATE POLICY "Staff can view own record" ON staff_directory
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Re-create the User Roles View
-- Fix: Drop table if it exists (handles 42809 error)
DROP TABLE IF EXISTS user_roles;
DROP VIEW IF EXISTS user_roles;

CREATE OR REPLACE VIEW user_roles AS
SELECT 
  sd.user_id as id, 
  sd.role 
FROM staff_directory sd
WHERE sd.user_id IS NOT NULL;

-- 5. Trigger for New Users (Ensures they get a staff entry)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.staff_directory (user_id, email, role, branch_id)
  VALUES (new.id, new.email, 'cashier', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Insert Default Settings (This reseeds the table we dropped)
INSERT INTO settings (key, value) VALUES
('dining_mode', 'false'::jsonb),
('kitchen_display_active', 'true'::jsonb),
('store_name', '"OpenTill POS"'::jsonb),
('tax_rate', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. Mock Function for "Create Employee" (Frontend compatibility)
-- Fix: Drop old function signature if return type changed
DROP FUNCTION IF EXISTS create_employee(text, text, text);

CREATE OR REPLACE FUNCTION create_employee(email_input TEXT, password_input TEXT, role_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO staff_directory (id, email, role)
  VALUES (uuid_generate_v4(), email_input, role_name)
  RETURNING id INTO new_id;
  
  RETURN json_build_object('id', new_id, 'status', 'created_local_only');
END;
$$;
