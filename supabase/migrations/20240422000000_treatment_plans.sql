-- Migration: Treatment Plans system
-- Target: Supabase SQL Editor

-- 1) Create treatment_plans table
CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Settings
  duration_min int NOT NULL,
  master_gain float NOT NULL DEFAULT 0.45,
  theta_beat_hz float NOT NULL DEFAULT 4,
  theta_gain float NOT NULL DEFAULT 0.12,
  fade_in_ms int NOT NULL DEFAULT 150,
  fade_out_ms int NOT NULL DEFAULT 200,
  
  -- State
  is_active boolean DEFAULT false,
  
  -- Traceability
  source_checkin_id uuid REFERENCES public.daily_checkins(id),
  change_reason text, -- e.g. "auto:score=-2"
  changed_field text, -- e.g. "duration_min"
  
  created_at timestamptz DEFAULT now()
);

-- 2) Database Integrity: Guarantee only one active plan per user
-- We use a partial unique index for this.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_user 
ON public.treatment_plans (user_id) 
WHERE (is_active = true);

-- 3) Security (RLS)
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own plans" ON public.treatment_plans;
CREATE POLICY "Users can manage their own plans"
ON public.treatment_plans
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Add dismissed column to daily_checkins for UX consistency
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_checkins' AND column_name='suggestion_dismissed') THEN
    ALTER TABLE public.daily_checkins ADD COLUMN suggestion_dismissed boolean DEFAULT false;
  END IF;
END $$;
