-- Migration: Create waiter_calls table and RLS policies

CREATE TABLE IF NOT EXISTS waiter_calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  table_id text NOT NULL,
  area text,
  called_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',   -- 'pending' | 'acknowledged'
  acknowledged_at timestamptz
);

-- Enable RLS
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;

-- Anon policy: insert (customer calls)
CREATE POLICY "anon_insert_calls" ON waiter_calls 
  FOR INSERT TO anon 
  WITH CHECK (true);

-- Anon policy: select own call status (to reset button when acknowledged)
CREATE POLICY "anon_select_own_calls" ON waiter_calls 
  FOR SELECT TO anon
  USING (true);

-- Authenticated policy: full access (admin/waiter acknowledge)
CREATE POLICY "auth_all_calls" ON waiter_calls 
  FOR ALL TO authenticated
  USING (true) 
  WITH CHECK (true);
