-- =====================================================================
-- WAITER ROLE SYSTEM DATABASE SETUP & RLS POLICIES MIGRATION
-- Project: Le Double Face Restaurant PWA
-- =====================================================================

-- 1. Create Waiters Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.waiters (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    assigned_tables text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on waiters
ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;

-- 2. Update Orders Table (Add waiter assignment & order_status columns)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_waiter_id uuid REFERENCES public.waiters(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_status text DEFAULT 'pending';

-- Add check constraint for order_status
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_order_status;
ALTER TABLE public.orders ADD CONSTRAINT check_order_status CHECK (order_status IN ('pending', 'seen', 'preparing', 'served', 'bill_requested', 'paid'));

-- 3. Create Helper Functions for Role Segregation
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  -- Admins are authenticated users who do not have the 'waiter' role in user_metadata
  RETURN (
    auth.role() = 'authenticated'
    AND coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'admin') != 'waiter'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_waiter()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  -- Waiters are authenticated users who explicitly have 'waiter' role in user_metadata
  RETURN (
    auth.role() = 'authenticated'
    AND auth.jwt() -> 'user_metadata' ->> 'role' = 'waiter'
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4. REBUILD RLS POLICIES WITH ROLE SEGREGATION
-- =====================================================================

-- --- A. waiters table policies ---
DROP POLICY IF EXISTS "Allow read waiters" ON public.waiters;
DROP POLICY IF EXISTS "Allow admin write waiters" ON public.waiters;
DROP POLICY IF EXISTS "Allow waiter self update" ON public.waiters;

-- Authenticated users (waiters and admins) can read waiters (e.g. to see online status)
CREATE POLICY "Allow read waiters" ON public.waiters FOR SELECT
TO authenticated USING (true);

-- Only admins can manage waiters
CREATE POLICY "Allow admin write waiters" ON public.waiters FOR ALL
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Waiters can update their own row (specifically last_seen heartbeat)
CREATE POLICY "Allow waiter self update" ON public.waiters FOR UPDATE
TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- --- B. menu_items table policies ---
DROP POLICY IF EXISTS "Allow admin insert menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow admin update menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow admin delete menu_items" ON public.menu_items;

CREATE POLICY "Allow admin insert menu_items" ON public.menu_items FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update menu_items" ON public.menu_items FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete menu_items" ON public.menu_items FOR DELETE
TO authenticated USING (public.is_admin());


-- --- C. orders table policies ---
DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin delete orders" ON public.orders;
DROP POLICY IF EXISTS "Allow waiter update orders" ON public.orders;

-- SELECT: Admins see all. Waiters see only their assigned tables' orders. Anon/Guests see all.
CREATE POLICY "Allow select orders" ON public.orders FOR SELECT
USING (
  public.is_admin()
  OR (public.is_waiter() AND (table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid())))
  OR (auth.role() = 'anon')
);

-- UPDATE: Admins can update any order. Waiters can update orders for assigned tables.
CREATE POLICY "Allow admin update orders" ON public.orders FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow waiter update orders" ON public.orders FOR UPDATE
TO authenticated USING (
  public.is_waiter() 
  AND (table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid()))
) WITH CHECK (
  public.is_waiter() 
  AND (table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid()))
);

-- DELETE: Only admins can delete orders
CREATE POLICY "Allow admin delete orders" ON public.orders FOR DELETE
TO authenticated USING (public.is_admin());


-- --- D. order_items table policies ---
DROP POLICY IF EXISTS "Allow admin update order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admin delete order_items" ON public.order_items;

CREATE POLICY "Allow admin update order_items" ON public.order_items FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete order_items" ON public.order_items FOR DELETE
TO authenticated USING (public.is_admin());


-- --- E. restaurant_tables table policies ---
DROP POLICY IF EXISTS "Allow admin insert restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin update restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin delete restaurant_tables" ON public.restaurant_tables;

CREATE POLICY "Allow admin insert restaurant_tables" ON public.restaurant_tables FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update restaurant_tables" ON public.restaurant_tables FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete restaurant_tables" ON public.restaurant_tables FOR DELETE
TO authenticated USING (public.is_admin());


-- --- F. shows table policies ---
DROP POLICY IF EXISTS "Allow admin insert shows" ON public.shows;
DROP POLICY IF EXISTS "Allow admin update shows" ON public.shows;
DROP POLICY IF EXISTS "Allow admin delete shows" ON public.shows;

CREATE POLICY "Allow admin insert shows" ON public.shows FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update shows" ON public.shows FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete shows" ON public.shows FOR DELETE
TO authenticated USING (public.is_admin());


-- --- G. tickets table policies ---
DROP POLICY IF EXISTS "Allow admin update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow admin delete tickets" ON public.tickets;

CREATE POLICY "Allow admin update tickets" ON public.tickets FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete tickets" ON public.tickets FOR DELETE
TO authenticated USING (public.is_admin());


-- --- H. hero_config table policies ---
DROP POLICY IF EXISTS "Allow admin insert hero_config" ON public.hero_config;
DROP POLICY IF EXISTS "Allow admin update hero_config" ON public.hero_config;
DROP POLICY IF EXISTS "Allow admin delete hero_config" ON public.hero_config;

CREATE POLICY "Allow admin insert hero_config" ON public.hero_config FOR INSERT
TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin update hero_config" ON public.hero_config FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete hero_config" ON public.hero_config FOR DELETE
TO authenticated USING (public.is_admin());
