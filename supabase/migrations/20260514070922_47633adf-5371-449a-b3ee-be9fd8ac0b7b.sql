-- Trigger to auto-unblock/activate licenses when a payment becomes paid
DROP TRIGGER IF EXISTS trg_on_payment_paid ON public.payments;
CREATE TRIGGER trg_on_payment_paid
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.on_payment_paid();

-- Allow unblocking even if expired-by-date (paid boleto reactivates)
CREATE OR REPLACE FUNCTION public.on_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    UPDATE public.licenses
    SET status = 'active'
    WHERE id = NEW.license_id
      AND status IN ('pending','blocked','expired');
  END IF;
  RETURN NEW;
END;
$function$;