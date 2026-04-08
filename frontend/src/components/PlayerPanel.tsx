import { useGameStore } from '../stores/gameStore.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

const PLAYER_COLORS: Record<PlayerId, string> = {
  P1: 'var(--p1-primary)',
  P2: 'var(--p2-primary)',
};

const PIECE_LABELS: Record<1 | 2 | 3, string> = { 1: 'S', 2: 'M', 3: 'L' };
const PIECE_SIZES_PX: Record<1 | 2 | 3, number> = { 1: 18, 2: 26, 3: 36 };

interface Props {
  playerId: PlayerId;
  isActive: boolean;
  isYou?: boolean;
}

export default function PlayerPanel({ playerId, isActive, isYou = false }: Props) {
  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceSize = useGameStore((s) => s.selectedPieceSize);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);

  if (!gameState) return null;

  const player = gameState.players[playerId];
  const color = PLAYER_COLORS[playerId];
  const { small, medium, large } = player.inventory;
  const counts: Record<1 | 2 | 3, number> = { 1: small, 2: medium, 3: large };

  function handleSelectPiece(size: 1 | 2 | 3) {
    if (!isYou || !isActive) return;
    if (counts[size] === 0) return;
    selectPiece(selectedPieceSize === size ? null : size);
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0.875rem 1.5rem',
      borderRadius: '0.75rem',
      background: 'var(--surface)',
      border: `2px solid ${isActive ? color : 'var(--border)'}`,
      transition: 'border-color 0.2s',
      width: '100%',
      maxWidth: '24rem',
    }}>
      {/* Color dot + name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: color }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.displayName}</span>
        </div>
        {isYou && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>You</span>}
      </div>

      {/* Piece inventory */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
        {([1, 2, 3] as const).map((size) => {
          const count = counts[size];
          const isSelected = isYou && isActive && selectedPieceSize === size;
          const canSelect = isYou && isActive && count > 0;
          return (
            <button
              key={size}
              onClick={() => handleSelectPiece(size)}
              disabled={!canSelect}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                background: isSelected ? color : 'transparent',
                border: `2px solid ${isSelected ? color : count > 0 ? color : 'var(--border)'}`,
                borderRadius: '0.5rem',
                padding: '0.4rem 0.6rem',
                cursor: canSelect ? 'pointer' : 'default',
                opacity: count === 0 ? 0.35 : 1,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Piece circle */}
              <div style={{
                width: PIECE_SIZES_PX[size],
                height: PIECE_SIZES_PX[size],
                borderRadius: '50%',
                background: isSelected ? '#fff' : color,
                transition: 'background 0.15s',
              }} />
              {/* Count dots */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < count ? (isSelected ? '#fff' : color) : 'var(--border)' }} />
                ))}
              </div>
              <span style={{ fontSize: '0.65rem', color: isSelected ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>
                {PIECE_LABELS[size]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
