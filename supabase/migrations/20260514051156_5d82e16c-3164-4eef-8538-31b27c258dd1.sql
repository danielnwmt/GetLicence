CREATE TYPE public.payable_status AS ENUM ('pending','paid','overdue','cancelled');
CREATE TYPE public.payable_category AS ENUM ('vps','storage','other');

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  supplier text,
  category payable_category NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  status payable_status NOT NULL DEFAULT 'pending',
  recurrence text NOT NULL DEFAULT 'none',
  license_id uuid,
  product_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payables" ON public.payables
  FOR ALL USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_payables_updated_at
  BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payables_status ON public.payables(status);
CREATE INDEX idx_payables_due_date ON public.payables(due_date);
CREATE INDEX idx_payables_license_id ON public.payables(license_id);