import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../db/supabase.js';

export const friendsRouter = Router();

/** GET /api/friends — list accepted friends */
friendsRouter.get('/', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const userId = req.userId!;

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      status,
      created_at
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Resolve the "other" user's profile + elo for each friendship
  const friendIds = (data ?? []).map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );

  if (friendIds.length === 0) { res.json([]); return; }

  const { data: users } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .in('id', friendIds);

  const { data: ratings } = await supabase
    .from('ratings')
    .select('user_id, elo')
    .in('user_id', friendIds);

  const usersMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
  const ratingsMap = Object.fromEntries((ratings ?? []).map((r) => [r.user_id, r.elo]));

  const friends = (data ?? []).map((f) => {
    const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
    const u = usersMap[otherId];
    return {
      friendshipId: f.id,
      userId: otherId,
      username: u?.username ?? null,
      avatarUrl: u?.avatar_url ?? null,
      elo: ratingsMap[otherId] ?? 1200,
      friendsSince: f.created_at,
    };
  });

  res.json(friends);
});

/** GET /api/friends/requests — incoming pending requests */
friendsRouter.get('/requests', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at')
    .eq('addressee_id', req.userId)
    .eq('status', 'pending');

  if (error) { res.status(500).json({ error: error.message }); return; }

  const requesterIds = (data ?? []).map((f) => f.requester_id);
  if (requesterIds.length === 0) { res.json([]); return; }

  const { data: users } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .in('id', requesterIds);

  const usersMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  res.json(
    (data ?? []).map((f) => ({
      friendshipId: f.id,
      userId: f.requester_id,
      username: usersMap[f.requester_id]?.username ?? null,
      avatarUrl: usersMap[f.requester_id]?.avatar_url ?? null,
      requestedAt: f.created_at,
    }))
  );
});

/** POST /api/friends/request — send a friend request */
friendsRouter.post('/request', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { username } = req.body as { username?: string };
  if (!username) { res.status(400).json({ error: 'username required.' }); return; }

  // Resolve username → id
  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('username', username.trim())
    .single();

  if (!target) { res.status(404).json({ error: 'User not found.' }); return; }
  if (target.id === req.userId) { res.status(400).json({ error: 'Cannot add yourself.' }); return; }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: req.userId, addressee_id: target.id, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Request already exists or you are already friends.' });
    } else {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(201).json({ friendshipId: data.id });
});

/** POST /api/friends/:id/accept — accept a pending request */
friendsRouter.post('/:id/accept', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('addressee_id', req.userId) // only addressee can accept
    .eq('status', 'pending');

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ ok: true });
});

/** DELETE /api/friends/:id — remove friend or cancel sent request */
friendsRouter.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', req.params.id)
    .or(`requester_id.eq.${req.userId},addressee_id.eq.${req.userId}`);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ ok: true });
});
