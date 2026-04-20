-- Migration: Initial Schema for user_profile
-- Created: 2024-04-20

CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sleep_hours float,
  sleep_latency text,
  wake_ups text,
  sleep_quality text,
  stress_level int,
  racing_thoughts text,
  bedtime time,
  screen_time text,
  plan jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso total al usuario único hardcodeado (simulación de usuario único)
CREATE POLICY "Allow all access to single user" ON user_profile
  FOR ALL
  USING (id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001');

-- Insertar el registro inicial si no existe (opcional, el cuestionario lo hará)
-- INSERT INTO user_profile (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
