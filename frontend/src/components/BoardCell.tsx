import { useState } from 'react';
import type { Cell } from '@tic-tac-gulp/shared';

const PLAYER_COLORS = {
  P1: 'var(--p1-primary)',
  P2: 'var(--p2-primary)',
};

const PIECE_SIZE_PX: Record<1 | 2 | 3, number> = { 1: 20, 2: 32, 3: 46 };

interface Props {
  cell: Cell;
  isValidTarget: boolean;
  isInvalidTarget: boolean;
  isWinCell: boolean;
  onClick: () => void;
}

export default function BoardCell({ cell, isValidTarget, isInvalidTarget, isWinCell, onClick }: Props) {
  const [shaking, setShaking] = useState(false);
  const topPiece = cell.stack.length > 0 ? cell.stack[cell.stack.length - 1] : null;
  const stackDepth = cell.stack.length;

  function handleClick() {
    if (isInvalidTarget && cell.stack.length > 0) {
      // Shake feedback for invalid placement on occupied cell
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
    onClick();
  }

  let borderColor = 'var(--border)';
  if (isWinCell) borderColor = 'var(--highlight)';
  else if (isValidTarget) borderColor = 'var(--highlight)';
  else if (isInvalidTarget && topPiece) borderColor = '#ef4444';

  return (
    <div
      onClick={handleClick}
      role="button"
      aria-label={`Cell row ${cell.row + 1} col ${cell.col + 1}${topPiece ? `, ${topPiece.owner} ${topPiece.size === 1 ? 'small' : topPiece.size === 2 ? 'medium' : 'large'} piece on top` : ', empty'}`}
      style={{
        width: '7rem',
        height: '7rem',
        borderRadius: '0.6rem',
        border: `2px solid ${borderColor}`,
        background: isWinCell ? 'rgba(251,191,36,0.1)' : isValidTarget ? 'rgba(251,191,36,0.07)' : 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isValidTarget ? 'pointer' : 'default',
        position: 'relative',
        transition: 'border-color 0.15s, background 0.15s',
        animation: shaking ? 'shake 0.4s ease' : undefined,
      }}
    >
      {/* Stack depth badge */}
      {stackDepth >= 2 && (
        <span style={{
          position: 'absolute',
          top: '0.3rem',
          right: '0.4rem',
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          fontWeight: 700,
        }}>
          ×{stackDepth}
        </span>
      )}

      {/* Peeking layers beneath top piece */}
      {topPiece && stackDepth >= 2 && cell.stack.slice(0, -1).map((piece, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: PIECE_SIZE_PX[piece.size],
            height: PIECE_SIZE_PX[piece.size],
            borderRadius: '50%',
            border: `3px solid ${PLAYER_COLORS[piece.owner]}`,
            opacity: 0.35,
          }}
        />
      ))}

      {/* Top (visible) piece */}
      {topPiece && (
        <div style={{
          width: PIECE_SIZE_PX[topPiece.size],
          height: PIECE_SIZE_PX[topPiece.size],
          borderRadius: '50%',
          background: PLAYER_COLORS[topPiece.owner],
          boxShadow: `0 2px 8px ${PLAYER_COLORS[topPiece.owner]}66`,
          zIndex: 1,
          transition: 'transform 0.2s',
        }} />
      )}

      {/* Valid target hover ring */}
      {isValidTarget && (
        <div style={{
          position: 'absolute',
          inset: '4px',
          borderRadius: '0.4rem',
          border: '2px dashed var(--highlight)',
          opacity: 0.5,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}
