
CREATE TYPE public.service_stage AS ENUM ('pre_trial','post_judgment','move_out');
CREATE TYPE public.customer_source AS ENUM ('web','manual');
CREATE TYPE public.judgment_result AS ENUM ('pending','tenant','landlord','dismissed');
CREATE TYPE public.case_stage AS ENUM ('pre_trial','trial_set','judgment','appeal','move_out','closed');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded');
CREATE TYPE public.order_disposition AS ENUM ('new','intake_review','docs_prep','awaiting_signature','filed','negotiating','completed','cancelled');
CREATE TYPE public.case_event_type AS ENUM ('deadline','task','filing','note');
CREATE TYPE public.app_role AS ENUM ('admin','staff');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid());
$$;

CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'staff')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stage public.service_stage NOT NULL,
  texas_authority TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage services" ON public.services FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  precinct TEXT,
  source public.customer_source NOT NULL DEFAULT 'web',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public intake can create customers" ON public.customers FOR INSERT TO anon WITH CHECK (source = 'web' AND created_by IS NULL);
CREATE POLICY "Staff manage customers" ON public.customers FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  cause_number TEXT,
  court_precinct TEXT,
  filing_date DATE,
  trial_date DATE,
  judgment_date DATE,
  judgment_result public.judgment_result NOT NULL DEFAULT 'pending',
  appeal_deadline DATE,
  writ_earliest DATE,
  stage public.case_stage NOT NULL DEFAULT 'pre_trial',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public intake can create cases" ON public.cases FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Staff manage cases" ON public.cases FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  service_id UUID NOT NULL REFERENCES public.services(id),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  disposition public.order_disposition NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public intake can create orders" ON public.orders FOR INSERT TO anon WITH CHECK (payment_status = 'unpaid' AND disposition = 'new' AND assigned_to IS NULL);
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE public.case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type public.case_event_type NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  next_step TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_events TO authenticated;
GRANT ALL ON public.case_events TO service_role;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage case events" ON public.case_events FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

INSERT INTO public.services (slug, name, description, stage, texas_authority, price_cents, sort_order) VALUES
('dont-lose-by-default', 'Don''t Lose by Default', 'Missing your eviction hearing is the single most common way tenants lose. We prepare and file your written answer and appearance so the court cannot enter a default judgment against you, and we walk you through exactly what to expect on your court date.', 'pre_trial', 'TRCP 510.4, 510.6', 19900, 1),
('7-day-trial-postponement', '7-Day Trial Postponement', 'Texas rules let a tenant request a postponement of the eviction trial for up to 7 days. We prepare and file the written motion for continuance so you have another week to gather rent money, documents, or legal help.', 'pre_trial', 'TRCP 510.7, 510.4', 14900, 2),
('landlord-agreed-extension', 'Landlord-Agreed Extension', 'We negotiate a written Rule 11 agreement with your landlord or their attorney for extra time or a payment plan, then file it with the court so the agreement is enforceable rather than a verbal promise.', 'pre_trial', 'TRCP 11, 510.7', 24900, 3),
('appeal-kit-attorney-referral', 'Appeal Kit + Attorney Referral', 'You have 5 days after judgment to appeal. We prepare your appeal bond or Statement of Inability to Afford Payment, file it before the deadline, and connect you with a Harris County eviction attorney for the county court trial.', 'post_judgment', 'TRCP 510.9, 510.8, 500.4', 34900, 4),
('cash-for-keys-managed-move-out', 'Cash-for-Keys / Managed Move-Out', 'If staying is not realistic, we negotiate a cash-for-keys or clean move-out agreement with your landlord: a firm move date, no writ, and often money to help you relocate, all documented in writing.', 'move_out', 'Prop. Code 24.0061', 29900, 5),
('writ-watch-emergency-move-out', 'Writ Watch / Emergency Move-Out', 'We monitor the court file daily for the writ of possession, alert you the moment it issues, and coordinate an emergency move-out plan so your belongings are never set out on the curb by a constable.', 'move_out', 'Prop. Code 24.0061, TRCP 510.8', 39900, 6);
