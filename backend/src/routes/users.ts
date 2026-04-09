import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { getSupabase } from '../db/supabase.js';

export const usersRouter = Router();

/**
 * GET /api/users/me
 * Returns the authenticated user's profile from public.users.
 * 404 if the user hasn't set a username yet (first sign-in).
 */
usersRouter.get('/me', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    res.status(503).json({ error: 'Database not configured.' });
    return;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, created_at')
    .eq('id', req.userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Profile not found.', code: 'PROFILE_NOT_FOUND' });
    return;
  }

  // Fetch ratings
  const { data: ratingData } = await supabase
    .from('ratings')
    .select('elo, wins, losses, draws')
    .eq('user_id', req.userId)
    .single();

  res.json({
    ...data,
    elo: ratingData?.elo ?? 1200,
    wins: ratingData?.wins ?? 0,
    losses: ratingData?.losses ?? 0,
    draws: ratingData?.draws ?? 0,
  });
});

/**
 * PUT /api/users/me
 * Creates or updates the authenticated user's profile.
 * On first call (after Google sign-in): creates public.users row + ratings row.
 */
usersRouter.put('/me', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    res.status(503).json({ error: 'Database not configured.' });
    return;
  }

  const { username } = req.body as { username?: string };

  if (!username || username.trim().length < 3 || username.trim().length > 20) {
    res.status(400).json({ error: 'Username must be 3–20 characters.' });
    return;
  }

  const trimmed = username.trim();

  // Upsert public.users row
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { id: req.userId, username: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select('id, username, avatar_url, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint on username
      res.status(409).json({ error: 'Username already taken.', code: 'USERNAME_TAKEN' });
    } else {
      console.error('[users] upsert error:', error.message);
      res.status(500).json({ error: 'Failed to save profile.' });
    }
    return;
  }

  // Ensure ratings row exists (insert if missing, ignore if exists)
  await supabase
    .from('ratings')
    .upsert({ user_id: req.userId }, { onConflict: 'user_id', ignoreDuplicates: true });

  res.json({ ...data, elo: 1200, wins: 0, losses: 0, draws: 0 });
});

/**
 * GET /api/users/:username
 * Public profile lookup by username.
 */
usersRouter.get('/:username', optionalAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    res.status(503).json({ error: 'Database not configured.' });
    return;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, created_at')
    .eq('username', req.params.username)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { data: ratingData } = await supabase
    .from('ratings')
    .select('elo, wins, losses, draws')
    .eq('user_id', data.id)
    .single();

  res.json({
    ...data,
    elo: ratingData?.elo ?? 1200,
    wins: ratingData?.wins ?? 0,
    losses: ratingData?.losses ?? 0,
    draws: ratingData?.draws ?? 0,
  });
});
