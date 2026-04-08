import { useGameStore } from '../stores/gameStore.js';
import { emitRematchAccept, emitRematchDecline } from '../stores/socketStore.js';
import { useNavigate } from 'react-router-dom';

export default function GameOverOverlay() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const reset = useGameStore((s) => s.reset);
  const navigate = useNavigate();

  if (!gameState || !yourPlayerId) return null;

  const { winner, endReason } = gameState;
  const isWinner = winner === yourPlayerId;
  const isDraw = winner === 'DRAW';

  let title = isDraw ? 'Draw!' : isWinner ? 'You Win!' : 'You Lose';
  let subtitle = '';
  if (endReason === 'forfeit' && !isDraw) {
    subtitle = isWinner ? 'Opponent disconnected.' : 'You forfeited.';
  }

  function handleLeave() {
    reset();
    navigate('/');
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: '1.25rem',
        padding: '3rem 3.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        maxWidth: '22rem',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '3rem',
          fontWeight: 800,
          color: isDraw ? 'var(--text-muted)' : isWinner ? 'var(--highlight)' : '#f87171',
        }}>
          {title}
        </p>

        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{subtitle}</p>}

        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          <button
            onClick={emitRematchAccept}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--p1-primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Rematch
          </button>
          <button
            onClick={handleLeave}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
