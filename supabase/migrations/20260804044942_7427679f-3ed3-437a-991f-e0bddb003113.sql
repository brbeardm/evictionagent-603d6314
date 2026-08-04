-- A. Roles: profiles = staff only
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

UPDATE public.profiles SET role = 'admin';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_user_id_idx ON public.customers(user_id);

-- B. Customer read access
CREATE OR REPLACE FUNCTION public.my_customer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_customer_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_customer_ids() TO authenticated;

CREATE POLICY "Customers view own record"
  ON public.customers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Customers view own cases"
  ON public.cases FOR SELECT TO authenticated
  USING (customer_id IN (SELECT public.my_customer_ids()));

CREATE POLICY "Customers view own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (customer_id IN (SELECT public.my_customer_ids()));

CREATE POLICY "Customers view own key dates"
  ON public.case_events FOR SELECT TO authenticated
  USING (
    event_type = 'deadline'
    AND case_id IN (
      SELECT c.id FROM public.cases c
      WHERE c.customer_id IN (SELECT public.my_customer_ids())
    )
  );