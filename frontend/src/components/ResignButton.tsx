import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { emitResign } from '../stores/socketStore.js';
import { useGameStore } from '../stores/gameStore.js';

export default function ResignButton() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const [confirming, setConfirming] = useState(false);

  if (!gameState || !yourPlayerId || gameState.status !== 'IN_PROGRESS') return null;

  function handleFirstClick() {
    setConfirming(true);
    // Auto-cancel confirmation after 4 seconds
    setTimeout(() => setConfirming(false), 4000);
  }

  function handleConfirm() {
    setConfirming(false);
    emitResign();
  }

  function handleCancel() {
    setConfirming(false);
  }

  return (
    <AnimatePresence mode="wait">
      {confirming ? (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}
        >
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            whiteSpace: 'nowrap',
          }}>
            Sure?
          </span>
          <button
            onClick={handleConfirm}
            style={{
              padding: '0.3rem 0.625rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.7rem',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            Yes
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '0.3rem 0.625rem',
              borderRadius: '0.4rem',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.7rem',
              cursor: 'pointer',
            }}
          >
            No
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="resign"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleFirstClick}
          title="Resign game"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.25rem 0.625rem',
            borderRadius: '2rem',
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171';
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
          }}
        >
          {/* Flag icon */}
          <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
            <line x1="1" y1="0.5" x2="1" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 1.5 L8 1.5 L6 4 L8 6.5 L1 6.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
          </svg>
          Resign
        </motion.button>
      )}
    </AnimatePresence>
  );
}
