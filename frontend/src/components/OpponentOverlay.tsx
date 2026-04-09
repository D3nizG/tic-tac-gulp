import { motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

const PLAYER_COLORS: Record<PlayerId, { primary: string; label: string }> = {
  P1: { primary: 'var(--p1-primary)', label: 'Blue' },
  P2: { primary: 'var(--p2-primary)', label: 'Orange' },
};

interface Props {
  opponentId: PlayerId;
  onClose: () => void;
}

export default function OpponentOverlay({ opponentId, onClose }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const sessionStats = useGameStore((s) => s.sessionStats);

  if (!gameState) return null;

  const player = gameState.players[opponentId];
  const { primary, label } = PLAYER_COLORS[opponentId];
  const { small, medium, large } = player.inventory;
  const totalPieces = small + medium + large;

  // From my perspective: opponent's wins = my losses, opponent's losses = my wins
  const opponentWins = sessionStats.losses;
  const opponentLosses = sessionStats.wins;
  const opponentDraws = sessionStats.draws;
  const totalGames = opponentWins + opponentLosses + opponentDraws;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
        }}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '14rem',
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '1rem',
          padding: '1.25rem',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        {/* Player header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: '50%',
            background: primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.875rem',
            fontWeight: 800,
            color: '#fff',
            fontFamily: 'var(--font-display)',
          }}>
            {player.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-display)',
              color: 'var(--text)',
              lineHeight: 1.2,
            }}>
              {player.displayName}
            </div>
            <div style={{
              fontSize: '0.65rem',
              color: primary,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {opponentId} · {label}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Session stats */}
        <div>
          <div style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            fontFamily: 'var(--font-display)',
          }}>
            This Session
          </div>
          {totalGames === 0 ? (
            <div style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.25)',
              fontFamily: 'var(--font-body)',
            }}>
              No games played yet
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { label: 'W', value: opponentWins, color: 'var(--highlight)' },
                { label: 'L', value: opponentLosses, color: '#f87171' },
                { label: 'D', value: opponentDraws, color: 'var(--text-muted)' },
              ].map(({ label: l, value, color }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    color,
                    lineHeight: 1,
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current inventory */}
        <div>
          <div style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            fontFamily: 'var(--font-display)',
          }}>
            Pieces Left
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {[
              { label: 'S', count: small, size: 10 },
              { label: 'M', count: medium, size: 14 },
              { label: 'L', count: large, size: 18 },
            ].map(({ label: l, count, size }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: count > 0 ? primary : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.15s',
                }} />
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: count > 0 ? primary : 'rgba(255,255,255,0.2)',
                }}>
                  ×{count}
                </span>
              </div>
            ))}
            <span style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
              marginLeft: 'auto',
            }}>
              {totalPieces}/9
            </span>
          </div>
        </div>

        {/* Session note */}
        <div style={{
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.18)',
          fontFamily: 'var(--font-body)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          Session stats only · Sign in for career stats
        </div>
      </motion.div>
    </>
  );
}
