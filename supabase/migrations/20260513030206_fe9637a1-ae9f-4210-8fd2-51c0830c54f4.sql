-- Revogar EXECUTE em funções internas (triggers/manutenção) que não devem ser chamadas via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.on_payment_paid() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_license_statuses() FROM anon, authenticated, public;