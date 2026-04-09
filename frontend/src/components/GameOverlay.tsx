import { motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import { emitRematchAccept, emitRematchDecline } from '../stores/socketStore.js';
import { useNavigate } from 'react-router-dom';

export default function GameOverlay() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const reset = useGameStore((s) => s.reset);
  const navigate = useNavigate();

  if (!gameState || !yourPlayerId) return null;

  const { winner, endReason } = gameState;
  const isWinner = winner === yourPlayerId;
  const isDraw = winner === 'DRAW';

  const title = isDraw ? 'Draw' : isWinner ? 'You Win' : 'You Lose';
  const emoji = isDraw ? '⚖️' : isWinner ? '🏆' : '💀';
  let subtitle = '';
  if (endReason === 'forfeit' && !isDraw) {
    subtitle = isWinner ? 'Opponent disconnected.' : 'Connection lost.';
  }

  const accentColor = isDraw
    ? 'var(--text-muted)'
    : isWinner
    ? 'var(--highlight)'
    : '#f87171';

  function handleLeave() {
    reset();
    navigate('/');
  }

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
              transition: 'opacity 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Rematch
          </button>
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
