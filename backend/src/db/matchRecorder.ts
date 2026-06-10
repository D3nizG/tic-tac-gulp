import type { GameState } from '@tic-tac-gulp/shared';
import { getSupabase } from './supabase.js';

let supportsMatchGulps = true;
let supportsRatingGulps = true;

interface RatingRow {
  elo?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  gulps?: number;
}

function missingColumn(error: { message?: string; code?: string } | null, column: string): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return Boolean(
    error &&
    (error.code === '42703' ||
      error.code === 'PGRST204' ||
      message.includes(`'${column.toLowerCase()}'`) ||
      message.includes(`column ${column.toLowerCase()}`) ||
      message.includes(`${column.toLowerCase()} column`))
  );
}

/**
 * Records a completed match to the `matches` table.
 * Only runs if both players are authenticated (have a userId).
 * Failures are logged but do not affect the game.
 */
export async function recordMatch(
  state: GameState,
  p1UserId: string | null,
  p2UserId: string | null
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return; // Supabase not configured
  if (!p1UserId && !p2UserId) return; // Neither player authenticated

  const winnerId = state.winner === 'P1' ? p1UserId
    : state.winner === 'P2' ? p2UserId
    : null;

  const durationMs = state.gameStartedAt
    ? Date.now() - state.gameStartedAt
    : null;

  const moveCount = state.moveCount ?? null;
  const p1Gulps = state.gulpCounts?.P1 ?? 0;
  const p2Gulps = state.gulpCounts?.P2 ?? 0;

  const matchRecord = {
    room_code:   state.roomCode ?? null,
    p1_user_id:  p1UserId,
    p2_user_id:  p2UserId,
    winner_id:   winnerId,
    end_reason:  state.endReason,
    move_count:  moveCount,
    duration_ms: durationMs,
  };
  const matchRecordWithGulps = {
    ...matchRecord,
    p1_gulps:    p1Gulps,
    p2_gulps:    p2Gulps,
  };

  let { error } = await supabase
    .from('matches')
    .insert(supportsMatchGulps ? matchRecordWithGulps : matchRecord);

  if (error && (missingColumn(error, 'p1_gulps') || missingColumn(error, 'p2_gulps'))) {
    supportsMatchGulps = false;
    ({ error } = await supabase.from('matches').insert(matchRecord));
  }

  if (error) {
    console.error('[matchRecorder] Failed to record match:', error.message);
  }

  await Promise.all([
    updateRating(p1UserId, state.winner === 'P1' ? 'win' : state.winner === 'DRAW' ? 'draw' : 'loss', p1Gulps),
    updateRating(p2UserId, state.winner === 'P2' ? 'win' : state.winner === 'DRAW' ? 'draw' : 'loss', p2Gulps),
  ]);
}

async function updateRating(
  userId: string | null,
  result: 'win' | 'loss' | 'draw',
  gulps: number
): Promise<void> {
  if (!userId) return;
  const supabase = getSupabase();
  if (!supabase) return;

  let { data: current, error: readError } = await supabase
    .from('ratings')
    .select(supportsRatingGulps ? 'elo, wins, losses, draws, gulps' : 'elo, wins, losses, draws')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError && missingColumn(readError, 'gulps')) {
    supportsRatingGulps = false;
    ({ data: current, error: readError } = await supabase
      .from('ratings')
      .select('elo, wins, losses, draws')
      .eq('user_id', userId)
      .maybeSingle());
  }

  if (readError) {
    console.error('[matchRecorder] Failed to read rating:', readError.message);
    return;
  }

  const rating = current as RatingRow | null;
  const elo = rating?.elo ?? 1200;
  const next = {
    user_id: userId,
    elo,
    wins: (rating?.wins ?? 0) + (result === 'win' ? 1 : 0),
    losses: (rating?.losses ?? 0) + (result === 'loss' ? 1 : 0),
    draws: (rating?.draws ?? 0) + (result === 'draw' ? 1 : 0),
    updated_at: new Date().toISOString(),
  };
  const nextWithGulps = {
    ...next,
    gulps: (rating?.gulps ?? 0) + gulps,
  };

  let { error } = await supabase
    .from('ratings')
    .upsert(supportsRatingGulps ? nextWithGulps : next, { onConflict: 'user_id' });

  if (error && missingColumn(error, 'gulps')) {
    supportsRatingGulps = false;
    ({ error } = await supabase
      .from('ratings')
      .upsert(next, { onConflict: 'user_id' }));
  }

  if (error) {
    console.error('[matchRecorder] Failed to update rating:', error.message);
  }
}
