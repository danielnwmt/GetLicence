
-- Sequência customer_number para profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_number BIGINT;
CREATE SEQUENCE IF NOT EXISTS public.profiles_customer_number_seq START 1;
ALTER TABLE public.profiles ALTER COLUMN customer_number SET DEFAULT nextval('public.profiles_customer_number_seq');

-- Preencher números existentes em ordem de criação
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.profiles WHERE customer_number IS NULL
)
UPDATE public.profiles p SET customer_number = o.rn
FROM ordered o WHERE p.id = o.id;

-- Avançar sequência
SELECT setval('public.profiles_customer_number_seq', COALESCE((SELECT MAX(customer_number) FROM public.profiles), 0) + 1, false);

ALTER TABLE public.profiles ALTER COLUMN customer_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_customer_number_key ON public.profiles(customer_number);

-- Atualizar handle_new_user para garantir customer_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END; $function$;

-- Campos para rastreio do software/ativação
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS device_ip TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS device_hostname TEXT;
