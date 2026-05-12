
-- Função: ao marcar pagamento como pago, ativa licença pendente/bloqueada
CREATE OR REPLACE FUNCTION public.on_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.licenses
    SET status = 'active'
    WHERE id = NEW.license_id
      AND status IN ('pending','blocked')
      AND expires_at > now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_payment_paid() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_payment_paid ON public.payments;
CREATE TRIGGER trg_on_payment_paid
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_paid();

-- Função: recalcula status (bloqueia inadimplentes, expira vencidas)
CREATE OR REPLACE FUNCTION public.refresh_license_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloqueia licenças com pagamento vencido não pago
  UPDATE public.licenses l
  SET status = 'blocked'
  WHERE l.status IN ('active','pending')
    AND EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.license_id = l.id
        AND p.status IN ('pending','failed')
        AND p.due_date IS NOT NULL
        AND p.due_date < CURRENT_DATE
    );

  -- Expira licenças cujo expires_at passou
  UPDATE public.licenses
  SET status = 'expired'
  WHERE status IN ('active','blocked','pending')
    AND expires_at < now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_license_statuses() FROM PUBLIC, anon, authenticated;

-- Cron diário às 03:00 para recalcular status
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('refresh-license-statuses') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-license-statuses'
);

SELECT cron.schedule(
  'refresh-license-statuses',
  '0 3 * * *',
  $$ SELECT public.refresh_license_statuses(); $$
);
