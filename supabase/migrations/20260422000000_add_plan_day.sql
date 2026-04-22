-- Migration: Add plan_day to user_profile
-- Created: 2026-04-22

ALTER TABLE public.user_profile
ADD COLUMN IF NOT EXISTS plan_day jsonb;

ALTER TABLE public.user_profile
ADD COLUMN IF NOT EXISTS questionnaire_mode text;
