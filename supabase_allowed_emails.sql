-- Allowed emails (private)
-- Target: Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.allowed_emails (email)
VALUES 
  ('pablo.daniel.fernandez369@gmail.com'),
  ('pablo._fernandez@outlook.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- No policies on purpose (server-only access via service role)
