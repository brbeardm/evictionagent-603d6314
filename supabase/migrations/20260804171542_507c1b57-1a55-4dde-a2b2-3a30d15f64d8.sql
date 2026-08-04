CREATE OR REPLACE FUNCTION public.orders_regen_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.case_id IS NOT NULL THEN
      PERFORM public.regenerate_case_events(OLD.case_id);
    END IF;
    RETURN NULL;
  END IF;

  IF NEW.case_id IS NOT NULL THEN
    PERFORM public.regenerate_case_events(NEW.case_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.case_id IS NOT NULL AND OLD.case_id IS DISTINCT FROM NEW.case_id THEN
    PERFORM public.regenerate_case_events(OLD.case_id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cases_regen_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.regenerate_case_events(NEW.id);
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.orders_regen_events() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cases_regen_events() FROM anon, authenticated;