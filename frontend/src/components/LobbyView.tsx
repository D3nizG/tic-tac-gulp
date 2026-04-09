import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import { emitStartGame } from '../stores/socketStore.js';

export default function LobbyView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const [copied, setCopied] = useState(false);

  if (!gameState) return null;

  const { players, roomCode } = gameState;
  const isHost = yourPlayerId === 'P1';
  const p2Joined = players.P2.displayName !== '';
  const canStart = isHost && p2Joined;

  function copyCode() {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      gap: '2.5rem',
      padding: '2rem',
      background: 'var(--bg)',
    }}>
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{ textAlign: 'center' }}
      >
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
          margin: 0,
        }}>
          Lobby
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem' }}>
          Waiting for players to join
        </p>
      </motion.div>

      {/* Room code */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.1 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.5rem 2.5rem',
          borderRadius: '1.25rem',
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.03)',
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          Room Code
        </p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '2.75rem',
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: 'var(--highlight)',
            fontFamily: 'var(--font-display)',
            textShadow: '0 0 24px var(--highlight-glow)',
          }}>
            {roomCode}
          </span>
          <motion.button
            onClick={copyCode}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            animate={{
              background: copied ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)',
              borderColor: copied ? 'rgba(34,197,94,0.5)' : 'var(--border)',
              color: copied ? '#4ade80' : 'var(--text-muted)',
            }}
            style={{
              padding: '0.4rem 0.875rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </motion.button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
          Share this code with your opponent
        </p>
      </motion.div>

      {/* Player slots */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <PlayerSlot
          name={players.P1.displayName}
          color="var(--p1-primary)"
          glow="var(--p1-glow)"
          label="P1"
          isYou={yourPlayerId === 'P1'}
          delay={0.15}
        />
        <AnimatePresence mode="wait">
          {p2Joined ? (
            <PlayerSlot
              key="p2-joined"
              name={players.P2.displayName}
              color="var(--p2-primary)"
              glow="var(--p2-glow)"
              label="P2"
              isYou={yourPlayerId === 'P2'}
              delay={0.05}
            />
          ) : (
            <motion.div
              key="p2-waiting"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.5rem 2rem',
                borderRadius: '1rem',
                background: 'var(--surface)',
                border: '1px dashed rgba(255,255,255,0.1)',
                minWidth: '9rem',
              }}
            >
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '2px dashed rgba(255,255,255,0.15)',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>Waiting…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>P2 · Orange</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Start / waiting message */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
      >
        {isHost ? (
          <motion.button
            onClick={canStart ? emitStartGame : undefined}
            disabled={!canStart}
            whileHover={canStart ? { scale: 1.04 } : {}}
            whileTap={canStart ? { scale: 0.96 } : {}}
            animate={canStart ? {
              boxShadow: ['0 0 0px rgba(37,99,235,0)', '0 0 24px rgba(37,99,235,0.5)', '0 0 0px rgba(37,99,235,0)'],
            } : {}}
            transition={canStart ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
            style={{
              padding: '0.975rem 3rem',
              borderRadius: '0.75rem',
              border: canStart ? 'none' : '1px solid var(--border)',
              background: canStart
                ? 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)'
                : 'var(--surface)',
              color: canStart ? '#fff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '1.05rem',
              fontFamily: 'var(--font-display)',
              cursor: canStart ? 'pointer' : 'not-allowed',
              letterSpacing: '0.04em',
            } as React.CSSProperties}
          >
            {canStart ? 'Start Game' : 'Waiting for opponent…'}
          </motion.button>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Waiting for the host to start…
          </p>
        )}
      </motion.div>
    </main>
  );
}

function PlayerSlot({
  name,
  color,
  glow,
  label,
  isYou,
  delay,
}: {
  name: string;
  color: string;
  glow: string;
  label: string;
  isYou: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, delay }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1.5rem 2rem',
        borderRadius: '1rem',
        background: 'var(--surface)',
        border: `1px solid ${color}55`,
        boxShadow: `0 0 12px ${glow}`,
        minWidth: '9rem',
      }}
    >
      <div style={{
        width: '3rem',
        height: '3rem',
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 16px ${glow}`,
      }} />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, fontFamily: 'var(--font-display)' }}>{name}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
          {label}{isYou ? ' · You' : ''}
        </p>
      </div>
    </motion.div>
  );
}
