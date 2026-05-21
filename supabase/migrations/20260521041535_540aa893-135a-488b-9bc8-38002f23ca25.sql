
-- Make customer_number nullable so system users (admins/operators) don't consume customer numbers
ALTER TABLE public.profiles ALTER COLUMN customer_number DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN customer_number DROP DEFAULT;

-- Update trigger: skip auto-create of profile/role for system users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'is_system_user','') = 'true' THEN
    -- system user (admin/operator); profile + role are inserted explicitly by the server function
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, customer_number)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, nextval('profiles_customer_number_seq'));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END; $function$;

-- Cleanup: existing admins should not consume customer numbers
UPDATE public.profiles p SET customer_number = NULL
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p.user_id AND ur.role='admin');

-- Reset sequence to max existing client number (+1 next)
SELECT setval('profiles_customer_number_seq',
  COALESCE((SELECT MAX(customer_number) FROM public.profiles), 0) + 1, false);
