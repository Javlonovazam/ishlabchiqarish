/*
#  Production System Schema

## Overview
Creates the database tables for a door production management ERP system with password-based authentication and role-based access control.

## Tables Created

### 1. users
- `id` (uuid, primary key)
- `login` (text, unique) - User's login name (e.g., 'general', 'admin')
- `password` (text) - Simple password for authentication
- `role` (text) - User role: 'GENERAL', 'ADMIN', or 'USER'
- `created_at` (timestamp)

### 2. orders
- `id` (uuid, primary key)
- `order_number` (text) - Zayavka raqami
- `door_count` (integer) - Number of doors
- `scheduled_date` (date) - Planned production date
- `status` (text) - Order status
- `operator` (text) - Operator who created the order
- `notes` (text) - Additional notes
- `created_at` (timestamp)

## Security
- RLS enabled on all tables
- Policies allow anon + authenticated access (shared data, custom auth)

## Initial Data
- Seeds default users: general (GENERAL), admin (ADMIN), user (USER)
*/

-- Users table for password-based authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('GENERAL', 'ADMIN', 'USER')),
  created_at timestamptz DEFAULT now()
);

-- Orders/Production table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  door_count integer NOT NULL CHECK (door_count > 0),
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  operator text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users policies (anon + authenticated for custom auth)
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE
  TO anon, authenticated USING (true);

-- Orders policies (anon + authenticated for custom auth)
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- Insert default users
INSERT INTO users (login, password, role) VALUES
  ('general', '77777', 'GENERAL'),
  ('admin', '12345', 'ADMIN'),
  ('user', '11111', 'USER')
ON CONFLICT (login) DO NOTHING;

-- Create index for faster date queries
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date ON orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);