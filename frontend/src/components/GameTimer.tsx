import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore.js';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function GameTimer() {
  const gameState = useGameStore((s) => s.gameState);
  const [elapsed, setElapsed] = useState(0);

  const gameStartedAt = gameState?.gameStartedAt ?? null;
  const isActive = gameState?.status === 'IN_PROGRESS';
  const isEnded = gameState?.status === 'ENDED';

  useEffect(() => {
    if (!gameStartedAt) return;

    // If game ended, show final duration (frozen)
    if (isEnded) {
      setElapsed(Date.now() - gameStartedAt);
      return;
    }

    if (!isActive) return;

    setElapsed(Date.now() - gameStartedAt);
    const id = setInterval(() => {
      setElapsed(Date.now() - gameStartedAt);
    }, 1000);
    return () => clearInterval(id);
  }, [gameStartedAt, isActive, isEnded]);

  if (!gameStartedAt || (!isActive && !isEnded)) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '2rem',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      fontSize: '0.75rem',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      color: 'var(--text-muted)',
      letterSpacing: '0.05em',
      userSelect: 'none',
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="5" y1="5" x2="5" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="5" x2="7.2" y2="6.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      {formatTime(elapsed)}
    </div>
  );
}
