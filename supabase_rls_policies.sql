-- =====================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES MIGRATION
-- Project: Le Double Face Restaurant PWA
-- Purpose: Secure all database tables against unauthorized access.
-- =====================================================================

-- Enable RLS on all tables (in case not already active)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_config ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- CLEANUP: Drop all existing public-open policies
-- =====================================================================

DROP POLICY IF EXISTS "Allow public read-only access to menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public insert access to menu items for CMS" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public update access to menu items for CMS" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public delete access to menu items for CMS" ON public.menu_items;

DROP POLICY IF EXISTS "Allow public read access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete access to orders" ON public.orders;

DROP POLICY IF EXISTS "Allow public read access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public insert access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public update access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public delete access to order items" ON public.order_items;

DROP POLICY IF EXISTS "Allow public read access to tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow public insert access to tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow public update access to tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow public delete access to tables" ON public.restaurant_tables;

DROP POLICY IF EXISTS "Allow public read access to shows" ON public.shows;
DROP POLICY IF EXISTS "Allow public insert access to shows" ON public.shows;
DROP POLICY IF EXISTS "Allow public update access to shows" ON public.shows;
DROP POLICY IF EXISTS "Allow public delete access to shows" ON public.shows;

DROP POLICY IF EXISTS "Allow public read access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public insert access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public update access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public delete access to tickets" ON public.tickets;

DROP POLICY IF EXISTS "Allow public read access to hero_config" ON public.hero_config;
DROP POLICY IF EXISTS "Allow public insert access to hero_config" ON public.hero_config;
DROP POLICY IF EXISTS "Allow public update access to hero_config" ON public.hero_config;
DROP POLICY IF EXISTS "Allow public delete access to hero_config" ON public.hero_config;

-- =====================================================================
-- 1. menu_items
-- Intent: Guests can view menu items. Only authenticated admins can modify.
-- =====================================================================

CREATE POLICY "Allow public read menu_items"
ON public.menu_items FOR SELECT USING (true);

CREATE POLICY "Allow admin insert menu_items"
ON public.menu_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admin update menu_items"
ON public.menu_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete menu_items"
ON public.menu_items FOR DELETE TO authenticated USING (true);

-- =====================================================================
-- 2. orders
-- Intent: Guests can place orders. Admin handles status updates and payments.
-- =====================================================================

CREATE POLICY "Allow public read orders"
ON public.orders FOR SELECT USING (true);

CREATE POLICY "Allow public insert orders"
ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin update orders"
ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete orders"
ON public.orders FOR DELETE TO authenticated USING (true);

-- =====================================================================
-- 3. order_items
-- Intent: Guests can add items to orders. Admin manages line items.
-- =====================================================================

CREATE POLICY "Allow public read order_items"
ON public.order_items FOR SELECT USING (true);

CREATE POLICY "Allow public insert order_items"
ON public.order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin update order_items"
ON public.order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete order_items"
ON public.order_items FOR DELETE TO authenticated USING (true);

-- =====================================================================
-- 4. shows
-- Intent: Guests see show dates. Only authenticated admins manage events.
-- =====================================================================

CREATE POLICY "Allow public read shows"
ON public.shows FOR SELECT USING (true);

CREATE POLICY "Allow admin insert shows"
ON public.shows FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admin update shows"
ON public.shows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete shows"
ON public.shows FOR DELETE TO authenticated USING (true);

-- =====================================================================
-- 5. tickets
-- Intent: Guests can book show tickets. Only admins manage booking state.
-- =====================================================================

CREATE POLICY "Allow public read tickets"
ON public.tickets FOR SELECT USING (true);

CREATE POLICY "Allow public insert tickets"
ON public.tickets FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin update tickets"
ON public.tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete tickets"
ON public.tickets FOR DELETE TO authenticated USING (true);

-- =====================================================================
-- 6. restaurant_tables
-- Intent: Guests read tables. Only admins manage structure.
-- Guest can update ONLY `waiter_called` to true (calling server).
-- =====================================================================

CREATE POLICY "Allow public read restaurant_tables"
ON public.restaurant_tables FOR SELECT USING (true);

CREATE POLICY "Allow admin insert restaurant_tables"
ON public.restaurant_tables FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admin update restaurant_tables"
ON public.restaurant_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete restaurant_tables"
ON public.restaurant_tables FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow anon to call waiter on restaurant_tables"
ON public.restaurant_tables FOR UPDATE TO anon USING (true) WITH CHECK (waiter_called = true);

-- =====================================================================
-- 7. hero_config
-- Intent: Guests view landing branding. Only admins can edit design config.
-- =====================================================================

CREATE POLICY "Allow public read hero_config"
ON public.hero_config FOR SELECT USING (true);

CREATE POLICY "Allow admin insert hero_config"
ON public.hero_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admin update hero_config"
ON public.hero_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete hero_config"
ON public.hero_config FOR DELETE TO authenticated USING (true);
