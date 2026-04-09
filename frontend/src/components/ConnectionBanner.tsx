import { AnimatePresence, motion } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';

export default function ConnectionBanner() {
  const isConnected = useGameStore((s) => s.isConnected);
  const isReconnecting = useGameStore((s) => s.isReconnecting);
  const disconnectedPlayer = useGameStore((s) => s.disconnectedPlayer);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const gameState = useGameStore((s) => s.gameState);

  const showReconnecting = !isConnected && isReconnecting;
  const isOpponentDisconnected =
    disconnectedPlayer !== null && disconnectedPlayer !== yourPlayerId;

  const show = showReconnecting || isOpponentDisconnected;

  let message = '';
  let subMessage = '';
  let bgColor = '#1e293b';

  if (showReconnecting) {
    message = 'Reconnecting…';
    subMessage = 'Trying to reach the server';
    bgColor = '#7c3aed';
  } else if (isOpponentDisconnected && gameState) {
    const name = gameState.players[disconnectedPlayer!].displayName;
    message = `${name} disconnected`;
    subMessage = 'They have 60 seconds to reconnect or forfeit';
    bgColor = '#b45309';
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            background: bgColor,
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {showReconnecting && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{
                width: '1rem',
                height: '1rem',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff', fontFamily: 'var(--font-display)' }}>
              {message}
            </div>
            {subMessage && (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.1rem' }}>
                {subMessage}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
