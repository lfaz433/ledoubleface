-- =====================================================================
-- POLICY UPDATE: WAITERS WITH EMPTY ASSIGNMENTS CAN MANAGE ALL TABLES
-- Project: Le Double Face Restaurant PWA
-- =====================================================================

DROP POLICY IF EXISTS "Allow select orders" ON public.orders;
DROP POLICY IF EXISTS "Allow waiter update orders" ON public.orders;

-- SELECT: Admins see all. Waiters see assigned tables, or ALL tables if assigned_tables is empty. Anon/Guests see all.
CREATE POLICY "Allow select orders" ON public.orders FOR SELECT
USING (
  public.is_admin()
  OR (
    public.is_waiter() 
    AND (
      table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid())
      OR (SELECT cardinality(assigned_tables) = 0 OR assigned_tables IS NULL FROM public.waiters WHERE id = auth.uid())
    )
  )
  OR (auth.role() = 'anon')
);

-- UPDATE: Waiters can update orders for assigned tables, or ALL tables if assigned_tables is empty.
CREATE POLICY "Allow waiter update orders" ON public.orders FOR UPDATE
TO authenticated USING (
  public.is_waiter() 
  AND (
    table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid())
    OR (SELECT cardinality(assigned_tables) = 0 OR assigned_tables IS NULL FROM public.waiters WHERE id = auth.uid())
  )
) WITH CHECK (
  public.is_waiter() 
  AND (
    table_id = ANY (SELECT unnest(assigned_tables) FROM public.waiters WHERE id = auth.uid())
    OR (SELECT cardinality(assigned_tables) = 0 OR assigned_tables IS NULL FROM public.waiters WHERE id = auth.uid())
  )
);
