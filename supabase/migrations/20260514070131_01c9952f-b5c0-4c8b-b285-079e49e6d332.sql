
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS block_grace_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS block_auto boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.refresh_license_statuses() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_grace integer := 0;
  v_auto boolean := true;
BEGIN
  SELECT COALESCE(block_grace_days,0), COALESCE(block_auto,true)
    INTO v_grace, v_auto
    FROM public.payment_settings LIMIT 1;

  IF v_auto THEN
    UPDATE public.licenses l SET status='blocked'
     WHERE l.status IN ('active','pending')
       AND EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.license_id = l.id
            AND p.status IN ('pending','failed')
            AND p.due_date IS NOT NULL
            AND p.due_date < (CURRENT_DATE - v_grace)
       );
  END IF;

  UPDATE public.licenses SET status='expired'
   WHERE status IN ('active','blocked','pending') AND expires_at < now();
END;
$$;
