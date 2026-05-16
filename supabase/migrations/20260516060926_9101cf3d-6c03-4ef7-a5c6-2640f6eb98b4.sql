CREATE OR REPLACE FUNCTION public.refresh_license_statuses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grace integer := 0;
  v_auto boolean := true;
BEGIN
  SELECT COALESCE(block_grace_days,0), COALESCE(block_auto,true)
    INTO v_grace, v_auto
    FROM public.payment_settings LIMIT 1;

  IF v_auto THEN
    -- Bloqueia licenças com boleto pendente/falho vencido há mais de v_grace dias
    UPDATE public.licenses l SET status='blocked'
     WHERE l.status IN ('active','pending')
       AND EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.license_id = l.id
            AND p.status IN ('pending','failed')
            AND p.due_date IS NOT NULL
            AND p.due_date < (CURRENT_DATE - v_grace)
       );

    -- Bloqueia licenças sem nenhum boleto emitido há mais de 15 dias
    UPDATE public.licenses l SET status='blocked'
     WHERE l.status IN ('active','pending')
       AND NOT EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.license_id = l.id
            AND p.created_at >= (now() - interval '15 days')
       );
  END IF;

  UPDATE public.licenses SET status='expired'
   WHERE status IN ('active','blocked','pending') AND expires_at < now();
END;
$function$;