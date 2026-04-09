import { motion } from 'motion/react';
import { useLocalStore } from '../stores/localStore.js';

const PLAYER_COLORS: Record<string, { primary: string; glow: string }> = {
  P1: { primary: 'var(--p1-primary)', glow: 'var(--p1-glow)' },
  P2: { primary: 'var(--p2-primary)', glow: 'var(--p2-glow)' },
};

export default function PassScreen() {
  const gameState = useLocalStore((s) => s.gameState);
  const dismissPass = useLocalStore((s) => s.dismissPass);

  if (!gameState) return null;

  const nextPlayer = gameState.currentTurn;
  const name = gameState.players[nextPlayer].displayName;
  const { primary, glow } = PLAYER_COLORS[nextPlayer];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={dismissPass}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        zIndex: 150,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Color accent bar at top */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: primary,
          boxShadow: `0 0 16px ${glow}`,
          transformOrigin: 'left',
        }}
      />

      {/* Avatar circle */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.05 }}
        style={{
          width: '5rem',
          height: '5rem',
          borderRadius: '50%',
          background: primary,
          boxShadow: `0 0 40px ${glow}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 800,
          color: '#fff',
          fontFamily: 'var(--font-display)',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          color: primary,
          letterSpacing: '-0.01em',
          textShadow: `0 0 24px ${glow}`,
          marginBottom: '0.4rem',
        }}>
          {name}'s turn
        </div>
        <div style={{
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
        }}>
          Pass the device
        </div>
      </motion.div>

      {/* Tap hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ delay: 0.6, duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          bottom: '3rem',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.3)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Tap anywhere to continue
      </motion.div>
    </motion.div>
  );
}
