import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useLocalStore } from '../stores/localStore.js';
import LocalGameScene from '../scene/LocalGameScene.js';
import PassScreen from '../components/PassScreen.js';
import type { PlayerId, PieceSize } from '@tic-tac-gulp/shared';

const PLAYER_COLORS: Record<PlayerId, { primary: string; glow: string }> = {
  P1: { primary: 'var(--p1-primary)', glow: 'var(--p1-glow)' },
  P2: { primary: 'var(--p2-primary)', glow: 'var(--p2-glow)' },
};
const PIECE_LABELS: Record<PieceSize, string> = { 1: 'S', 2: 'M', 3: 'L' };
const PIECE_SIZES_PX: Record<PieceSize, number> = { 1: 20, 2: 28, 3: 38 };
const TURN_LIMIT = 13;

// ── Setup screen ────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (p1: string, p2: string) => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const navigate = useNavigate();

  const valid = (s: string) => s.trim().length >= 2 && s.trim().length <= 16;
  const canStart = valid(p1) && valid(p2);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '1.5rem',
          padding: '2.5rem 2rem',
          width: '100%',
          maxWidth: '22rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Local 2-Player
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
            Pass the device between turns
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {([
            { label: 'Player 1', value: p1, set: setP1, color: 'var(--p1-primary)' },
            { label: 'Player 2', value: p2, set: setP2, color: 'var(--p2-primary)' },
          ] as const).map(({ label, value, set, color }) => (
            <div key={label}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '0.35rem',
              }}>
                {label}
              </label>
              <input
                value={value}
                onChange={(e) => set(e.target.value.slice(0, 16))}
                placeholder="Enter name…"
                maxLength={16}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.625rem',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = color)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => canStart && onStart(p1.trim(), p2.trim())}
          disabled={!canStart}
          style={{
            padding: '0.875rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: canStart
              ? 'linear-gradient(135deg, var(--p1-primary) 0%, var(--p2-primary) 100%)'
              : 'rgba(255,255,255,0.05)',
            color: canStart ? '#fff' : 'rgba(255,255,255,0.2)',
            fontWeight: 700,
            fontSize: '0.95rem',
            fontFamily: 'var(--font-display)',
            cursor: canStart ? 'pointer' : 'default',
            transition: 'opacity 0.15s',
            letterSpacing: '0.03em',
          }}
        >
          Start Game
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          ← Back
        </button>
      </motion.div>
    </div>
  );
}

// ── Local PlayerPanel ───────────────────────────────────────────────────────

function LocalPlayerPanel({ playerId, isActive }: { playerId: PlayerId; isActive: boolean }) {
  const gameState = useLocalStore((s) => s.gameState);
  const selectedPieceSize = useLocalStore((s) => s.selectedPieceSize);
  const selectPiece = useLocalStore((s) => s.selectPiece);

  if (!gameState) return null;
  const player = gameState.players[playerId];
  const { primary, glow } = PLAYER_COLORS[playerId];
  const { small, medium, large } = player.inventory;
  const counts: Record<PieceSize, number> = { 1: small, 2: medium, 3: large };

  return (
    <motion.div
      animate={{
        borderColor: isActive ? primary : 'rgba(255,255,255,0.06)',
        boxShadow: isActive ? `0 0 16px ${glow}` : 'none',
      }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.875rem',
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        width: '100%',
        maxWidth: '26rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '5rem' }}>
        <motion.div
          animate={{ scale: isActive ? [1, 1.2, 1] : 1 }}
          transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
          style={{ width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: primary }}
        />
        <span style={{ fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-display)' }}>
          {player.displayName}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
        {([1, 2, 3] as PieceSize[]).map((size) => {
          const count = counts[size];
          const isSelected = isActive && selectedPieceSize === size;
          const canSelect = isActive && count > 0;
          return (
            <motion.button
              key={size}
              onClick={() => canSelect && selectPiece(isSelected ? null : size)}
              disabled={!canSelect}
              whileHover={canSelect ? { scale: 1.08 } : {}}
              whileTap={canSelect ? { scale: 0.94 } : {}}
              animate={{
                background: isSelected ? primary : 'transparent',
                borderColor: isSelected ? primary : count > 0 ? `${primary}66` : 'rgba(255,255,255,0.06)',
                boxShadow: isSelected ? `0 0 14px ${glow}` : 'none',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                border: '1.5px solid',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.45rem',
                cursor: canSelect ? 'pointer' : 'default',
                opacity: count === 0 ? 0.3 : 1,
                minWidth: '2.5rem',
              }}
            >
              <div style={{
                width: PIECE_SIZES_PX[size],
                height: PIECE_SIZES_PX[size],
                borderRadius: '50%',
                background: isSelected ? '#fff' : primary,
              }} />
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: i < count ? (isSelected ? 'rgba(255,255,255,0.9)' : primary) : 'rgba(255,255,255,0.08)',
                  }} />
                ))}
              </div>
              <span style={{
                fontSize: '0.6rem',
                color: isSelected ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
              }}>
                {PIECE_LABELS[size]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Local game timer (countdown) ────────────────────────────────────────────

function LocalGameTimer() {
  const gameState = useLocalStore((s) => s.gameState);
  const [remaining, setRemaining] = useState(TURN_LIMIT);

  const turnStartedAt = gameState?.turnStartedAt ?? null;
  const isActive = gameState?.status === 'IN_PROGRESS';

  useEffect(() => {
    if (!turnStartedAt || !isActive) { setRemaining(TURN_LIMIT); return; }
    function update() {
      const r = Math.max(0, TURN_LIMIT - Math.floor((Date.now() - turnStartedAt!) / 1000));
      setRemaining(r);
    }
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [turnStartedAt, isActive]);

  if (!isActive || !turnStartedAt) return null;
  const isUrgent = remaining <= 5;
  const pct = remaining / TURN_LIMIT;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <svg width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
        <circle
          cx="13" cy="13" r="10" fill="none"
          stroke={isUrgent ? '#f87171' : 'rgba(255,255,255,0.35)'}
          strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 10}`}
          strokeDashoffset={`${2 * Math.PI * 10 * (1 - pct)}`}
          transform="rotate(-90 13 13)"
          style={{ transition: 'stroke 0.3s' }}
        />
      </svg>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem',
        color: isUrgent ? '#f87171' : 'var(--text-muted)', minWidth: '1.2rem',
      }}>
        {remaining}
      </span>
    </div>
  );
}

// ── Local game over overlay ─────────────────────────────────────────────────

function LocalGameOverlay() {
  const gameState = useLocalStore((s) => s.gameState);
  const rematch = useLocalStore((s) => s.rematch);
  const reset = useLocalStore((s) => s.reset);
  const navigate = useNavigate();

  if (!gameState || gameState.status !== 'ENDED') return null;

  const { winner, endReason, players } = gameState;
  const isDraw = winner === 'DRAW';
  const winnerName = isDraw ? null : players[winner as PlayerId].displayName;
  const emoji = isDraw ? '⚖️' : '🏆';
  const title = isDraw ? 'Draw' : `${winnerName} Wins!`;
  const accentColor = isDraw
    ? 'var(--text-muted)'
    : winner === 'P1' ? 'var(--p1-primary)' : 'var(--p2-primary)';
  let subtitle = '';
  if (endReason === 'resign') subtitle = `${players[winner === 'P1' ? 'P2' : 'P1'].displayName} resigned.`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,15,30,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.05 }}
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '1.5rem',
          padding: '3rem 3.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1.5rem', maxWidth: '22rem', width: '90%', textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}
          style={{ fontSize: '3.5rem', lineHeight: 1 }}
        >
          {emoji}
        </motion.div>
        <h2 style={{
          fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)',
          color: accentColor, margin: 0, letterSpacing: '-0.01em',
          textShadow: isDraw ? 'none' : `0 0 24px ${accentColor}`,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            {subtitle}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <button
            onClick={rematch}
            style={{
              flex: 1, padding: '0.875rem', borderRadius: '0.75rem', border: 'none',
              background: 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              fontFamily: 'var(--font-display)', cursor: 'pointer',
            }}
          >
            Rematch
          </button>
          <button
            onClick={() => { reset(); navigate('/'); }}
            style={{
              flex: 1, padding: '0.875rem', borderRadius: '0.75rem',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function LocalGamePage() {
  const gameState = useLocalStore((s) => s.gameState);
  const passMode = useLocalStore((s) => s.passMode);
  const initGame = useLocalStore((s) => s.initGame);
  const reset = useLocalStore((s) => s.reset);

  // Clean up on unmount
  useEffect(() => () => reset(), [reset]);

  if (!gameState) {
    return <SetupScreen onStart={initGame} />;
  }

  const { currentTurn, status } = gameState;
  const opponent: PlayerId = currentTurn === 'P1' ? 'P2' : 'P1';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: 'var(--bg)', overflow: 'hidden', position: 'relative',
    }}>
      {/* Opponent panel (top) */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '0.5rem', padding: '0.875rem 1rem 0.5rem', flexShrink: 0, zIndex: 10,
      }}>
        <LocalPlayerPanel playerId={opponent} isActive={currentTurn === opponent} />
        {/* Turn badge + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            padding: '0.45rem 1.4rem', borderRadius: '2rem',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.875rem',
            fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
          }}>
            {gameState.players[currentTurn].displayName}'s turn
          </div>
          <LocalGameTimer />
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <LocalGameScene />
      </div>

      {/* Your panel (bottom) */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0.5rem 1rem 0.875rem', flexShrink: 0, zIndex: 10,
      }}>
        <LocalPlayerPanel playerId={currentTurn} isActive />
      </div>

      {/* Pass screen */}
      <AnimatePresence>
        {passMode && <PassScreen />}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {status === 'ENDED' && <LocalGameOverlay />}
      </AnimatePresence>
    </div>
  );
}
