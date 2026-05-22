WITH ranked AS (
  SELECT p.user_id, ROW_NUMBER() OVER (ORDER BY p.created_at) AS rn
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin'
  )
)
UPDATE public.profiles p SET customer_number = r.rn
FROM ranked r WHERE p.user_id = r.user_id;

SELECT setval('public.profiles_customer_number_seq', COALESCE((SELECT MAX(customer_number) FROM public.profiles), 0), true);