CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff'::public.app_role, 'admin'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION private.my_customer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.is_staff() FROM public;
REVOKE ALL ON FUNCTION private.my_customer_ids() FROM public;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.my_customer_ids() TO authenticated;

-- profiles
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
CREATE POLICY "Staff can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.is_staff());

-- services
DROP POLICY IF EXISTS "Staff manage services" ON public.services;
CREATE POLICY "Staff manage services" ON public.services
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

-- customers
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
CREATE POLICY "Staff manage customers" ON public.customers
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

-- cases
DROP POLICY IF EXISTS "Staff manage cases" ON public.cases;
CREATE POLICY "Staff manage cases" ON public.cases
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Customers view own cases" ON public.cases;
CREATE POLICY "Customers view own cases" ON public.cases
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT private.my_customer_ids()));

-- orders
DROP POLICY IF EXISTS "Staff manage orders" ON public.orders;
CREATE POLICY "Staff manage orders" ON public.orders
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT private.my_customer_ids()));

-- case_events
DROP POLICY IF EXISTS "Staff manage case events" ON public.case_events;
CREATE POLICY "Staff manage case events" ON public.case_events
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Customers view own key dates" ON public.case_events;
CREATE POLICY "Customers view own key dates" ON public.case_events
  FOR SELECT TO authenticated
  USING (
    event_type = 'deadline'::public.case_event_type
    AND case_id IN (
      SELECT c.id FROM public.cases c
      WHERE c.customer_id IN (SELECT private.my_customer_ids())
    )
  );

DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.my_customer_ids();