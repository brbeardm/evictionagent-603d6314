REVOKE ALL ON FUNCTION public.regenerate_case_events(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cases_set_derived_dates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cases_regen_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.orders_regen_events() FROM PUBLIC, anon, authenticated;