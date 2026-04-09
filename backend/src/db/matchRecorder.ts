import type { GameState } from '@tic-tac-gulp/shared';
import { getSupabase } from './supabase.js';

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

  const { error } = await supabase.from('matches').insert({
    room_code:   state.roomCode ?? null,
    p1_user_id:  p1UserId,
    p2_user_id:  p2UserId,
    winner_id:   winnerId,
    end_reason:  state.endReason,
    move_count:  moveCount,
    duration_ms: durationMs,
  });

  if (error) {
    console.error('[matchRecorder] Failed to record match:', error.message);
  }
}
