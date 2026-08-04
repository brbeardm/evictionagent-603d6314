
DROP POLICY "Public intake can create cases" ON public.cases;
CREATE POLICY "Public intake can create cases" ON public.cases FOR INSERT TO anon
WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.source = 'web'));

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
