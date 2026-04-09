import { AnimatePresence, motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';

export default function TurnBadge() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);

  if (!gameState || !yourPlayerId) return null;

  const { currentTurn, players } = gameState;
  const isYourTurn = currentTurn === yourPlayerId;
  const turnLabel = isYourTurn ? 'Your turn' : `${players[currentTurn].displayName}'s turn`;

  return (
    <div style={{ position: 'relative', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTurn}
          initial={{ opacity: 0, y: -8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            padding: '0.45rem 1.4rem',
            borderRadius: '2rem',
            background: isYourTurn
              ? 'linear-gradient(135deg, var(--highlight) 0%, #f59e0b 100%)'
              : 'var(--surface)',
            border: isYourTurn ? 'none' : '1px solid var(--border)',
            color: isYourTurn ? '#0a0f1e' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.04em',
            boxShadow: isYourTurn ? '0 0 16px var(--highlight-glow)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {turnLabel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
