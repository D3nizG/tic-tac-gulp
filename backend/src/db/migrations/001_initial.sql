-- Run this in Supabase SQL editor after creating your project.
-- Table: users (mirrors Supabase auth.users via trigger or manual insert)

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY,  -- matches auth.users.id from Supabase Auth
  username    TEXT UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table: matches (one row per completed game)

CREATE TABLE IF NOT EXISTS public.matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT NOT NULL,
  p1_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  p2_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  end_reason  TEXT CHECK (end_reason IN ('normal', 'forfeit', 'resign', 'draw')),
  move_count  INT,
  duration_ms INT,
  played_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Table: ratings (one row per user, updated after each rated match)

CREATE TABLE IF NOT EXISTS public.ratings (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  elo         INT DEFAULT 1200 NOT NULL,
  wins        INT DEFAULT 0 NOT NULL,
  losses      INT DEFAULT 0 NOT NULL,
  draws       INT DEFAULT 0 NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common lookups

CREATE INDEX IF NOT EXISTS matches_p1_user_id_idx ON public.matches(p1_user_id);
CREATE INDEX IF NOT EXISTS matches_p2_user_id_idx ON public.matches(p2_user_id);
CREATE INDEX IF NOT EXISTS matches_played_at_idx  ON public.matches(played_at DESC);
CREATE INDEX IF NOT EXISTS ratings_elo_idx        ON public.ratings(elo DESC);

-- Row Level Security (enable but allow service role full access)
-- Frontend queries should go through the backend; the anon key has no direct table access.

ALTER TABLE public.users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data
CREATE POLICY "users: read own row" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users: insert own row" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users: update own row" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "ratings: read all" ON public.ratings
  FOR SELECT USING (true);  -- leaderboard is public

CREATE POLICY "matches: read own matches" ON public.matches
  FOR SELECT USING (auth.uid() = p1_user_id OR auth.uid() = p2_user_id);
