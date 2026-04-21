-- SQL Migration for Sleep Check-ins (Production Ready)
-- Target: Supabase SQL Editor

-- 1) Prerequisites
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

-- 3) Security (RLS)
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own check-ins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can view their own check-ins" ON public.daily_checkins;
DROP POLICY IF EXISTS "Users can update their own check-ins" ON public.daily_checkins;

CREATE POLICY "Users can create their own check-ins"
ON public.daily_checkins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own check-ins"
ON public.daily_checkins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
ON public.daily_checkins
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_checkins_updated_at ON public.daily_checkins;

CREATE TRIGGER trg_daily_checkins_updated_at
BEFORE UPDATE ON public.daily_checkins
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
