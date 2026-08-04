-- 4. clean holiday fn (drop dead PERFORM)
CREATE OR REPLACE FUNCTION public.is_tx_court_holiday(d date)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  y int := EXTRACT(YEAR FROM d)::int;
  m int := EXTRACT(MONTH FROM d)::int;
  dd int := EXTRACT(DAY FROM d)::int;
  dow int := EXTRACT(ISODOW FROM d)::int;
BEGIN
  IF m = 1 AND dd = 1 THEN RETURN true; END IF;
  IF m = 1 AND dow = 1 AND dd BETWEEN 15 AND 21 THEN RETURN true; END IF;
  IF m = 2 AND dow = 1 AND dd BETWEEN 15 AND 21 THEN RETURN true; END IF;
  IF m = 3 AND dd = 2 THEN RETURN true; END IF;
  IF m = 4 AND dd = 21 THEN RETURN true; END IF;
  IF m = 5 AND dow = 1 AND dd > 24 THEN RETURN true; END IF;
  IF m = 6 AND dd = 19 THEN RETURN true; END IF;
  IF m = 7 AND dd = 4 THEN RETURN true; END IF;
  IF m = 8 AND dd = 27 THEN RETURN true; END IF;
  IF m = 9 AND dow = 1 AND dd <= 7 THEN RETURN true; END IF;
  IF m = 11 AND dd = 11 THEN RETURN true; END IF;
  IF m = 11 AND dow = 4 AND dd BETWEEN 22 AND 28 THEN RETURN true; END IF;
  IF m = 11 AND dow = 5 AND dd BETWEEN 23 AND 29 THEN RETURN true; END IF;
  IF m = 12 AND dd IN (24,25,26) THEN RETURN true; END IF;
  RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION public.is_tx_court_holiday(date) FROM PUBLIC, anon;

-- 1. remove duplicate pre-trial generic task
CREATE OR REPLACE FUNCTION public.regenerate_case_events(p_case_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.cases%ROWTYPE;
  o RECORD;
  task_title text;
  task_step text;
  task_due date;
BEGIN
  SELECT * INTO c FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM public.case_events
  WHERE case_id = p_case_id AND auto_generated = true AND completed_at IS NULL;

  IF c.judgment_date IS NOT NULL THEN
    INSERT INTO public.case_events (case_id, event_type, title, due_date, next_step, auto_generated)
    VALUES
      (p_case_id, 'deadline', 'Appeal deadline (5 days)', c.appeal_deadline,
       'File appeal bond or Statement of Inability to Afford Payment before this date, or the right to appeal is lost.', true),
      (p_case_id, 'deadline', 'Writ may issue (day 6)', c.writ_earliest,
       'Landlord can request a writ of possession on/after this date — confirm move-out or stay plan.', true);
  ELSIF c.trial_date IS NOT NULL THEN
    INSERT INTO public.case_events (case_id, event_type, title, due_date, next_step, auto_generated)
    VALUES
      (p_case_id, 'deadline', 'Court date', c.trial_date,
       'Client must appear or be represented — confirm attendance.', true);
  END IF;

  FOR o IN
    SELECT ord.id AS order_id, s.slug
    FROM public.orders ord
    JOIN public.services s ON s.id = ord.service_id
    WHERE ord.case_id = p_case_id AND ord.disposition <> 'cancelled'
  LOOP
    task_due := COALESCE(
      CASE WHEN o.slug = 'appeal-kit-attorney-referral' THEN c.appeal_deadline END,
      c.appeal_deadline,
      GREATEST(c.trial_date - 3, CURRENT_DATE),
      CURRENT_DATE
    );
    IF c.judgment_date IS NULL AND c.trial_date IS NOT NULL THEN
      task_due := GREATEST(LEAST(c.trial_date - 3, c.trial_date), CURRENT_DATE);
      IF task_due > c.trial_date THEN task_due := c.trial_date; END IF;
    END IF;

    CASE o.slug
      WHEN 'dont-lose-by-default' THEN
        task_title := 'Prepare & file the tenant''s written Answer';
        task_step := 'Draft the Answer and file it with the JP court before the trial setting.';
      WHEN '7-day-trial-postponement' THEN
        task_title := 'Prepare & file Motion for Continuance (7-day)';
        task_step := 'File the motion with the court and notify the landlord''s attorney.';
      WHEN 'landlord-agreed-extension' THEN
        task_title := 'Contact landlord/attorney to negotiate a written Rule 11 agreement';
        task_step := 'Call the landlord or their attorney and get any agreement in writing and filed.';
      WHEN 'appeal-kit-attorney-referral' THEN
        task_title := 'Prepare appeal paperwork + send curated attorney referral';
        task_step := 'Assemble the appeal bond/pauper''s affidavit packet and email the referral list.';
      WHEN 'cash-for-keys-managed-move-out' THEN
        task_title := 'Open cash-for-keys negotiation with the landlord';
        task_step := 'Pitch a move-out date in exchange for dismissal and relocation funds, in writing.';
      WHEN 'writ-watch-emergency-move-out' THEN
        task_title := 'Begin daily writ-of-possession monitoring';
        task_step := 'Check the precinct docket daily and alert the client the moment a writ is issued.';
      ELSE
        task_title := 'Complete first service action';
        task_step := 'Review the order and take the first required action.';
    END CASE;

    INSERT INTO public.case_events (case_id, order_id, event_type, title, due_date, next_step, auto_generated)
    VALUES (p_case_id, o.order_id, 'task', task_title, task_due, task_step, true);
  END LOOP;
END;
$function$;

-- 2. regen on order update/delete
CREATE OR REPLACE FUNCTION public.orders_regen_events()
 RETURNS trigger
 LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS orders_regen_events_upd ON public.orders;
CREATE TRIGGER orders_regen_events_upd
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_regen_events();

DROP TRIGGER IF EXISTS orders_regen_events_del ON public.orders;
CREATE TRIGGER orders_regen_events_del
AFTER DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_regen_events();

-- 3. remove unused anon write access
DROP POLICY IF EXISTS "Public intake can create customers" ON public.customers;
DROP POLICY IF EXISTS "Public intake can create cases" ON public.cases;
DROP POLICY IF EXISTS "Public intake can create orders" ON public.orders;

REVOKE INSERT ON public.customers FROM anon;
REVOKE INSERT ON public.cases FROM anon;
REVOKE INSERT ON public.orders FROM anon;