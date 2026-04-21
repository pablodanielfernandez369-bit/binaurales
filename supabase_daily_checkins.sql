-- SQL Migration for Sleep Check-ins
-- Target: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL, -- Format: YYYY-MM-DD
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Structure defined by UX requirements
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Business Rule: One check-in per user per local day
    UNIQUE(user_id, checkin_date)
);

-- Enable RLS
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Users
CREATE POLICY "Users can create their own check-ins"
ON public.daily_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own check-ins"
ON public.daily_checkins FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
ON public.daily_checkins FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: No FIXED_USER_ID used here. Real Auth is required.
