-- 1. Coluna para forçar troca de senha
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. Criar admin padrão (idempotente)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@gelicence.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'admin@gelicence.com',
      crypt('admin1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrador"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    -- Identidade (necessária p/ login por email em alguns ambientes)
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@gelicence.com', 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  END IF;

  -- Garante profile + flag de troca obrigatória
  INSERT INTO public.profiles (user_id, full_name, email, must_change_password)
  VALUES (v_user_id, 'Administrador', 'admin@gelicence.com', true)
  ON CONFLICT (user_id) DO UPDATE
    SET must_change_password = true,
        email = EXCLUDED.email;

  -- Garante papel admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove papel 'client' duplicado se o trigger tiver criado
  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'client';
END $$;