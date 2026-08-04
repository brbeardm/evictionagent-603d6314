ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_stripe_session_id_idx ON public.orders (stripe_session_id);

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
    WHERE ord.case_id = p_case_id
      AND ord.disposition <> 'cancelled'
      AND ord.payment_status = 'paid'
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