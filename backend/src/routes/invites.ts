import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSupabase } from '../db/supabase.js';

export const invitesRouter = Router();

/** GET /api/invites — list pending game invites addressed to current user */
invitesRouter.get('/', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { data, error } = await supabase
    .from('game_invites')
    .select('id, from_user_id, room_code, created_at, expires_at')
    .eq('to_user_id', req.userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const fromIds = (data ?? []).map((i) => i.from_user_id);
  if (fromIds.length === 0) { res.json([]); return; }

  const { data: users } = await supabase
    .from('users')
    .select('id, username')
    .in('id', fromIds);

  const usersMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.username]));

  res.json(
    (data ?? []).map((inv) => ({
      id: inv.id,
      fromUserId: inv.from_user_id,
      fromUsername: usersMap[inv.from_user_id] ?? null,
      roomCode: inv.room_code,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
    }))
  );
});

/** POST /api/invites — send a game invite */
invitesRouter.post('/', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { toUsername, roomCode } = req.body as { toUsername?: string; roomCode?: string };
  if (!toUsername || !roomCode) {
    res.status(400).json({ error: 'toUsername and roomCode required.' });
    return;
  }

  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('username', toUsername.trim())
    .single();

  if (!target) { res.status(404).json({ error: 'User not found.' }); return; }
  if (target.id === req.userId) { res.status(400).json({ error: 'Cannot invite yourself.' }); return; }

  const { data, error } = await supabase
    .from('game_invites')
    .insert({
      from_user_id: req.userId,
      to_user_id: target.id,
      room_code: roomCode.toUpperCase(),
    })
    .select('id')
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(201).json({ inviteId: data.id });
});

/** DELETE /api/invites/:id — decline / dismiss an invite */
invitesRouter.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) { res.status(503).json({ error: 'Database not configured.' }); return; }

  const { error } = await supabase
    .from('game_invites')
    .delete()
    .eq('id', req.params.id)
    .or(`to_user_id.eq.${req.userId},from_user_id.eq.${req.userId}`);

  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ ok: true });
});
