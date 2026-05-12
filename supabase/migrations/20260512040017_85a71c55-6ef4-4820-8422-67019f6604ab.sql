
-- 1. Adicionar valor "blocked" ao enum license_status
ALTER TYPE public.license_status ADD VALUE IF NOT EXISTS 'blocked';
