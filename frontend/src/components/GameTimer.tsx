import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';

const TURN_LIMIT = 13;

export default function GameTimer() {
  const gameState = useGameStore((s) => s.gameState);
  const [remaining, setRemaining] = useState(TURN_LIMIT);

  const turnStartedAt = gameState?.turnStartedAt ?? null;
  const isActive = gameState?.status === 'IN_PROGRESS';

  useEffect(() => {
    if (!turnStartedAt || !isActive) {
      setRemaining(TURN_LIMIT);
      return;
    }

    function update() {
      const elapsed = Date.now() - turnStartedAt!;
      const r = Math.max(0, TURN_LIMIT - Math.floor(elapsed / 1000));
      setRemaining(r);
    }

    update();
    const id = setInterval(update, 200); // poll at 200ms for smooth updates
    return () => clearInterval(id);
  }, [turnStartedAt, isActive]);

  if (!isActive || !turnStartedAt) return null;

  const isUrgent = remaining <= 5;
  const pct = remaining / TURN_LIMIT; // 1.0 → 0.0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {/* Arc progress ring */}
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle
          cx="13" cy="13" r="10"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        {/* Progress */}
        <motion.circle
          cx="13" cy="13" r="10"
          fill="none"
          stroke={isUrgent ? '#f87171' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 10}`}
          strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct)}`}
          transform="rotate(-90 13 13)"
          animate={{ stroke: isUrgent ? '#f87171' : 'rgba(255,255,255,0.35)' }}
          transition={{ duration: 0.3 }}
        />
      </svg>

      {/* Number */}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={remaining}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.12 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: isUrgent ? '#f87171' : 'var(--text-muted)',
            minWidth: '1.2rem',
            textAlign: 'left',
            lineHeight: 1,
          }}
        >
          {remaining}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
