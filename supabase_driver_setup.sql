-- =====================================================================
-- DRIVER ROLE SYSTEM DATABASE SETUP & RLS POLICIES MIGRATION
-- Project: Le Double Face Restaurant PWA
-- =====================================================================

-- 1. Create Drivers Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 2. Create Helper Function: is_driver
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  -- Drivers are authenticated users who explicitly have 'driver' role in user_metadata
  RETURN (
    auth.role() = 'authenticated'
    AND auth.jwt() -> 'user_metadata' ->> 'role' = 'driver'
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Update Orders Table (Add driver assignment & delivery_status columns)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';

-- Add check constraint for delivery_status
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_delivery_status;
ALTER TABLE public.orders ADD CONSTRAINT check_delivery_status CHECK (delivery_status IN ('pending', 'assigned', 'shipping', 'delivered'));

-- =====================================================================
-- 4. REBUILD RLS POLICIES WITH DRIVER AND WAITER SEGREGATION
-- =====================================================================

-- --- A. drivers table policies ---
DROP POLICY IF EXISTS "Allow read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Allow admin write drivers" ON public.drivers;
DROP POLICY IF EXISTS "Allow driver self update" ON public.drivers;

-- Authenticated users (staff and admins) can read drivers (e.g. to list active ones)
CREATE POLICY "Allow read drivers" ON public.drivers FOR SELECT
TO authenticated USING (true);

-- Only admins can manage drivers (CRUD)
CREATE POLICY "Allow admin write drivers" ON public.drivers FOR ALL
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Drivers can update their own row (specifically last_seen heartbeat)
CREATE POLICY "Allow driver self update" ON public.drivers FOR UPDATE
TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- --- B. orders table select & update policies ---
DROP POLICY IF EXISTS "Allow select orders" ON public.orders;

-- SELECT: Admins see all. Waiters see assigned tables. Drivers see all delivery orders or assigned ones. Anon/Guests see all.
CREATE POLICY "Allow select orders" ON public.orders FOR SELECT
USING (
  public.is_admin()
  OR (public.is_waiter() AND (table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid())))
  OR (public.is_driver() AND (table_id = 'DELIVERY' AND (assigned_driver_id = auth.uid() OR assigned_driver_id IS NULL)))
  OR (auth.role() = 'anon')
);

DROP POLICY IF EXISTS "Allow driver update orders" ON public.orders;

-- UPDATE: Drivers can update orders assigned to them or unassigned deliveries to pick them up
CREATE POLICY "Allow driver update orders" ON public.orders FOR UPDATE
TO authenticated USING (
  public.is_driver()
  AND table_id = 'DELIVERY'
  AND (assigned_driver_id = auth.uid() OR assigned_driver_id IS NULL)
) WITH CHECK (
  public.is_driver()
  AND table_id = 'DELIVERY'
  AND (assigned_driver_id = auth.uid() OR assigned_driver_id IS NULL)
);

-- =====================================================================
-- 5. ENABLE REALTIME
-- =====================================================================
begin;
  alter publication supabase_realtime add table public.drivers;
exception when others then
  raise notice 'Could not automatically add drivers to publication';
end;
commit;
