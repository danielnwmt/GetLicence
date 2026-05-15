CREATE TABLE IF NOT EXISTS public.boleto_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boleto_descriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage boleto_descriptions" ON public.boleto_descriptions;
CREATE POLICY "Admins manage boleto_descriptions" ON public.boleto_descriptions
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));