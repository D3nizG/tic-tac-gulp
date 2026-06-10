-- Migration 003: profile metrics used by public profiles

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS gulps INT DEFAULT 0 NOT NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS p1_gulps INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS p2_gulps INT DEFAULT 0 NOT NULL;
