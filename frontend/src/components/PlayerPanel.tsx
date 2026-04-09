import { motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

const PLAYER_COLORS: Record<PlayerId, { primary: string; glow: string }> = {
  P1: { primary: 'var(--p1-primary)', glow: 'var(--p1-glow)' },
  P2: { primary: 'var(--p2-primary)', glow: 'var(--p2-glow)' },
};

const PIECE_LABELS: Record<1 | 2 | 3, string> = { 1: 'S', 2: 'M', 3: 'L' };
const PIECE_SIZES_PX: Record<1 | 2 | 3, number> = { 1: 20, 2: 28, 3: 38 };

interface Props {
  playerId: PlayerId;
  isActive: boolean;
  isYou?: boolean;
  onInfoClick?: () => void;
}

export default function PlayerPanel({ playerId, isActive, isYou = false, onInfoClick }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceSize = useGameStore((s) => s.selectedPieceSize);
  const selectPiece = useGameStore((s) => s.selectPiece);

  if (!gameState) return null;

  const player = gameState.players[playerId];
  const { primary: color, glow } = PLAYER_COLORS[playerId];
  const { small, medium, large } = player.inventory;
  const counts: Record<1 | 2 | 3, number> = { 1: small, 2: medium, 3: large };

  function handleSelectPiece(size: 1 | 2 | 3) {
    if (!isYou || !isActive) return;
    if (counts[size] === 0) return;
    selectPiece(selectedPieceSize === size ? null : size);
  }

  return (
    <motion.div
      animate={{
        borderColor: isActive ? color : 'rgba(255,255,255,0.06)',
        boxShadow: isActive ? `0 0 16px ${glow}` : 'none',
      }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.875rem 1.25rem',
        borderRadius: '0.875rem',
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        width: '100%',
        maxWidth: '26rem',
      }}
    >
      {/* Color dot + name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '5.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <motion.div
            animate={{ scale: isActive ? [1, 1.2, 1] : 1 }}
            transition={{ repeat: isActive ? Infinity : 0, duration: 2, ease: 'easeInOut' }}
            style={{ width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: color, flexShrink: 0 }}
          />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-display)' }}>
            {player.displayName}
          </span>
          {!isYou && onInfoClick && (
            <button
              onClick={onInfoClick}
              title="View opponent info"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.1rem',
                height: '1.1rem',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.6rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            >
              i
            </button>
          )}
        </div>
        {isYou && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            You
          </span>
        )}
      </div>

      {/* Piece inventory */}
      <div style={{ display: 'flex', gap: '0.625rem', flex: 1, justifyContent: 'flex-end' }}>
        {([1, 2, 3] as const).map((size) => {
          const count = counts[size];
          const isSelected = isYou && isActive && selectedPieceSize === size;
          const canSelect = isYou && isActive && count > 0;

          return (
            <motion.button
              key={size}
              onClick={() => handleSelectPiece(size)}
              disabled={!canSelect}
              whileHover={canSelect ? { scale: 1.08 } : {}}
              whileTap={canSelect ? { scale: 0.94 } : {}}
              animate={{
                background: isSelected ? color : 'transparent',
                borderColor: isSelected ? color : count > 0 ? `${color}66` : 'rgba(255,255,255,0.06)',
                boxShadow: isSelected ? `0 0 14px ${glow}` : 'none',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem',
                border: '1.5px solid',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.5rem',
                cursor: canSelect ? 'pointer' : 'default',
                opacity: count === 0 ? 0.3 : 1,
                minWidth: '2.75rem',
              }}
            >
              {/* Piece circle */}
              <div style={{
                width: PIECE_SIZES_PX[size],
                height: PIECE_SIZES_PX[size],
                borderRadius: '50%',
                background: isSelected ? '#fff' : color,
                transition: 'background 0.15s',
                flexShrink: 0,
              }} />
              {/* Dot count */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: i < count ? (isSelected ? 'rgba(255,255,255,0.9)' : color) : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>
              <span style={{
                fontSize: '0.6rem',
                color: isSelected ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.04em',
              }}>
                {PIECE_LABELS[size]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
