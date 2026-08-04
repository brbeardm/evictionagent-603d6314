ALTER TABLE public.case_events ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_tx_court_holiday(d date)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  y int := EXTRACT(YEAR FROM d)::int;
  m int := EXTRACT(MONTH FROM d)::int;
  dd int := EXTRACT(DAY FROM d)::int;
  dow int := EXTRACT(ISODOW FROM d)::int;
  jan1 date := make_date(y,1,1);
BEGIN
  -- New Year's Day, Jan 1
  IF m = 1 AND dd = 1 THEN RETURN true; END IF;
  -- MLK Day: 3rd Monday in January
  IF m = 1 AND dow = 1 AND dd BETWEEN 15 AND 21 THEN RETURN true; END IF;
  -- Presidents Day: 3rd Monday in February
  IF m = 2 AND dow = 1 AND dd BETWEEN 15 AND 21 THEN RETURN true; END IF;
  -- Texas Independence Day, Mar 2
  IF m = 3 AND dd = 2 THEN RETURN true; END IF;
  -- San Jacinto Day, Apr 21
  IF m = 4 AND dd = 21 THEN RETURN true; END IF;
  -- Memorial Day: last Monday in May
  IF m = 5 AND dow = 1 AND dd > 24 THEN RETURN true; END IF;
  -- Emancipation Day (Juneteenth), Jun 19
  IF m = 6 AND dd = 19 THEN RETURN true; END IF;
  -- Independence Day, Jul 4
  IF m = 7 AND dd = 4 THEN RETURN true; END IF;
  -- LBJ Day, Aug 27
  IF m = 8 AND dd = 27 THEN RETURN true; END IF;
  -- Labor Day: 1st Monday in September
  IF m = 9 AND dow = 1 AND dd <= 7 THEN RETURN true; END IF;
  -- Veterans Day, Nov 11
  IF m = 11 AND dd = 11 THEN RETURN true; END IF;
  -- Thanksgiving: 4th Thursday in November, and the Friday after
  IF m = 11 AND dow = 4 AND dd BETWEEN 22 AND 28 THEN RETURN true; END IF;
  IF m = 11 AND dow = 5 AND dd BETWEEN 23 AND 29 THEN RETURN true; END IF;
  -- Christmas Eve / Christmas / day after
  IF m = 12 AND dd IN (24,25,26) THEN RETURN true; END IF;
  PERFORM jan1;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_business_day(d date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r date := d;
  guard int := 0;
BEGIN
  IF r IS NULL THEN RETURN NULL; END IF;
  WHILE (EXTRACT(ISODOW FROM r)::int IN (6,7) OR public.is_tx_court_holiday(r)) AND guard < 30 LOOP
    r := r + 1;
    guard := guard + 1;
  END LOOP;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_case_events(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.cases%ROWTYPE;
  o RECORD;
  prep_due date;
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
    prep_due := GREATEST(c.trial_date - 3, CURRENT_DATE);
    IF prep_due > c.trial_date THEN prep_due := c.trial_date; END IF;
    INSERT INTO public.case_events (case_id, event_type, title, due_date, next_step, auto_generated)
    VALUES
      (p_case_id, 'deadline', 'Court date', c.trial_date,
       'Client must appear or be represented — confirm attendance.', true),
      (p_case_id, 'task', 'Prepare & file paperwork before court', prep_due,
       'Confirm the filing checklist for the purchased service and prepare documents.', true);
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
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_case_events(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.cases_set_derived_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.judgment_date IS NOT NULL THEN
    NEW.appeal_deadline := public.next_business_day(NEW.judgment_date + 5);
    NEW.writ_earliest := public.next_business_day(NEW.judgment_date + 6);
  ELSE
    NEW.appeal_deadline := NULL;
    NEW.writ_earliest := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cases_regen_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.regenerate_case_events(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_regen_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    PERFORM public.regenerate_case_events(NEW.case_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS cases_derived_dates ON public.cases;
CREATE TRIGGER cases_derived_dates
BEFORE INSERT OR UPDATE OF judgment_date ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.cases_set_derived_dates();

DROP TRIGGER IF EXISTS cases_regen_events_ins ON public.cases;
CREATE TRIGGER cases_regen_events_ins
AFTER INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.cases_regen_events();

DROP TRIGGER IF EXISTS cases_regen_events_upd ON public.cases;
CREATE TRIGGER cases_regen_events_upd
AFTER UPDATE OF trial_date, judgment_date ON public.cases
FOR EACH ROW
WHEN (NEW.trial_date IS DISTINCT FROM OLD.trial_date OR NEW.judgment_date IS DISTINCT FROM OLD.judgment_date)
EXECUTE FUNCTION public.cases_regen_events();

DROP TRIGGER IF EXISTS orders_regen_events_ins ON public.orders;
CREATE TRIGGER orders_regen_events_ins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_regen_events();