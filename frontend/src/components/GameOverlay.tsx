import { AnimatePresence, motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import { emitRematchAccept, emitRematchDecline } from '../stores/socketStore.js';
import { useNavigate } from 'react-router-dom';

export default function GameOverlay() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const rematchState = useGameStore((s) => s.rematchState);
  const reset = useGameStore((s) => s.reset);
  const navigate = useNavigate();

  if (!gameState || !yourPlayerId) return null;

  const { winner, endReason, players } = gameState;
  const isWinner = winner === yourPlayerId;
  const isDraw = winner === 'DRAW';

  let title = isDraw ? 'Draw' : isWinner ? 'You Win' : 'You Lose';
  const emoji = isDraw ? '⚖️' : isWinner ? '🏆' : '💀';

  let subtitle = '';
  if (endReason === 'forfeit' && !isDraw) {
    subtitle = isWinner ? 'Opponent disconnected.' : 'Connection lost.';
  } else if (endReason === 'resign' && !isDraw) {
    subtitle = isWinner ? 'Opponent resigned.' : 'You resigned.';
    if (!isWinner) title = 'Resigned';
  }

  const accentColor = isDraw
    ? 'var(--text-muted)'
    : isWinner
    ? 'var(--highlight)'
    : '#f87171';

  function handleLeave() {
    emitRematchDecline(); // always notify opponent we're leaving
    reset();
    navigate('/');
  }

  // Rematch button content and behavior based on state
  const rematchButton = (() => {
    switch (rematchState) {
      case 'i_requested':
        return (
          <div style={{
            flex: 1,
            padding: '0.875rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: 'rgba(255,255,255,0.6)',
                flexShrink: 0,
              }}
            />
            Waiting…
          </div>
        );

      case 'opponent_requested':
        return (
          <motion.button
            onClick={emitRematchAccept}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'linear-gradient(135deg, var(--highlight) 0%, #f59e0b 100%)',
              color: '#0a0f1e',
              fontWeight: 700,
              fontSize: '0.875rem',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              boxShadow: '0 0 20px var(--highlight-glow)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <span style={{ fontSize: '0.65rem', opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Opponent wants a rematch!
            </span>
            Accept
          </motion.button>
        );

      case 'unavailable':
        return (
          <div style={{
            flex: 1,
            padding: '0.875rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-display)',
            textAlign: 'center',
            opacity: 0.5,
          }}>
            {players[yourPlayerId === 'P1' ? 'P2' : 'P1'].displayName} left
          </div>
        );

      default: // idle
        return (
          <button
            onClick={emitRematchAccept}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Rematch
          </button>
        );
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,15,30,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.05 }}
        style={{
          background: 'var(--surface)',
          border: `1px solid rgba(255,255,255,0.07)`,
          borderRadius: '1.5rem',
          padding: '3rem 3.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          maxWidth: '22rem',
          width: '90%',
          textAlign: 'center',
          boxShadow: `0 0 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)`,
        }}
      >
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}
          style={{ fontSize: '3.5rem', lineHeight: 1 }}
        >
          {emoji}
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: accentColor,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            textShadow: isDraw || !isWinner ? 'none' : `0 0 24px ${accentColor}`,
            margin: 0,
          }}
        >
          {title}
        </motion.h2>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}
          >
            {subtitle}
          </motion.p>
        )}

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ display: 'flex', gap: '0.75rem', width: '100%' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={rematchState}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, display: 'flex' }}
            >
              {rematchButton}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={handleLeave}
            style={{
              flex: 1,
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s, opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Leave
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
