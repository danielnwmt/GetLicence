-- 1) Remove plaintext password column entirely
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_plain;

-- 2) Lock down user_roles: explicit deny for self-insert/update/delete by non-admins
-- The existing "Admins manage roles" ALL policy stays. Add a restrictive policy so
-- only admins can write, regardless of any future permissive policy added by mistake.
DROP POLICY IF EXISTS "Only admins can write roles" ON public.user_roles;
CREATE POLICY "Only admins can write roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from anon; keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_license_statuses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_payment_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- has_role is used inside RLS policies; keep callable but not by anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;