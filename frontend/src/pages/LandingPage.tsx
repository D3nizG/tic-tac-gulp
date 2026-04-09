import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore.js';
import { getSocket } from '../stores/socketStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

export default function LandingPage() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const nameValid = displayName.trim().length >= 3 && displayName.trim().length <= 16;

  async function handleCreate() {
    if (!nameValid) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create room.');
      const { roomCode, playerId, sessionId } = await res.json();

      setSession(playerId, roomCode, sessionId);
      localStorage.setItem('ttg_sessionId', sessionId);
      localStorage.setItem('ttg_roomCode', roomCode);

      const socket = getSocket();
      socket.connect();
      socket.once('connect', () => {
        socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
      });

      navigate(`/room/${roomCode}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!nameValid || joinCode.trim().length !== 6) return;
    setLoading(true);
    setError('');
    const code = joinCode.trim().toUpperCase();
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? 'Failed to join room.');
      }
      const { roomCode, playerId, sessionId } = await res.json();

      setSession(playerId, roomCode, sessionId);
      localStorage.setItem('ttg_sessionId', sessionId);
      localStorage.setItem('ttg_roomCode', roomCode);

      const socket = getSocket();
      socket.connect();
      socket.once('connect', () => {
        socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
      });

      navigate(`/room/${roomCode}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      padding: '2rem',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />
      {/* Center glow orb */}
      <div style={{
        position: 'absolute',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3rem', zIndex: 1, width: '100%', maxWidth: '26rem' }}>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          style={{ textAlign: 'center' }}
        >
          <motion.h1
            initial={{ opacity: 0, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, letterSpacing: '-0.01em' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(2.25rem, 8vw, 3.5rem)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Tic-Tac-<span style={{
              color: 'var(--p2-primary)',
              textShadow: '0 0 32px rgba(234,88,12,0.5)',
            }}>Gulp</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              marginTop: '0.875rem',
              lineHeight: 1.6,
              maxWidth: '24rem',
            }}
          >
            Stack larger pieces to gulp smaller ones.
            Get three in a row to win.
          </motion.p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
          style={{
            width: '100%',
            background: 'rgba(20,28,51,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1.5rem',
            padding: '2rem',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name input */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <input
                type="text"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={16}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--p1-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </motion.div>

            {/* Mode toggle / join input */}
            <AnimatePresence mode="wait">
              {mode === 'idle' ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex', gap: '0.75rem' }}
                >
                  <motion.button
                    onClick={handleCreate}
                    disabled={!nameValid || loading}
                    whileHover={nameValid ? { scale: 1.02 } : {}}
                    whileTap={nameValid ? { scale: 0.97 } : {}}
                    style={{
                      ...btnStyle,
                      flex: 1,
                      background: nameValid
                        ? 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)'
                        : 'rgba(37,99,235,0.2)',
                      color: nameValid ? '#fff' : 'rgba(255,255,255,0.35)',
                      cursor: nameValid && !loading ? 'pointer' : 'not-allowed',
                      boxShadow: nameValid ? '0 0 16px rgba(37,99,235,0.35)' : 'none',
                    }}
                  >
                    {loading ? <Spinner /> : 'Create Game'}
                  </motion.button>
                  <motion.button
                    onClick={() => setMode('join')}
                    disabled={!nameValid}
                    whileHover={nameValid ? { scale: 1.02 } : {}}
                    whileTap={nameValid ? { scale: 0.97 } : {}}
                    style={{
                      ...btnStyle,
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: nameValid ? 'var(--text)' : 'var(--text-muted)',
                      cursor: nameValid ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Join Game
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <input
                    type="text"
                    placeholder="Room code (6 characters)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--p2-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(234,88,12,0.15)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <motion.button
                      onClick={() => { setMode('idle'); setError(''); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      style={{ ...btnStyle, flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      Back
                    </motion.button>
                    <motion.button
                      onClick={handleJoin}
                      disabled={!nameValid || joinCode.trim().length !== 6 || loading}
                      whileHover={(nameValid && joinCode.length === 6) ? { scale: 1.02 } : {}}
                      whileTap={(nameValid && joinCode.length === 6) ? { scale: 0.97 } : {}}
                      style={{
                        ...btnStyle,
                        flex: 1,
                        background: (nameValid && joinCode.length === 6)
                          ? 'linear-gradient(135deg, var(--p2-primary) 0%, #c2410c 100%)'
                          : 'rgba(234,88,12,0.2)',
                        color: (nameValid && joinCode.length === 6) ? '#fff' : 'rgba(255,255,255,0.35)',
                        cursor: (nameValid && joinCode.length === 6 && !loading) ? 'pointer' : 'not-allowed',
                        boxShadow: (nameValid && joinCode.length === 6) ? '0 0 16px rgba(234,88,12,0.35)' : 'none',
                      }}
                    >
                      {loading ? <Spinner /> : 'Join'}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    color: '#f87171',
                    fontSize: '0.825rem',
                    margin: 0,
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(239,68,68,0.1)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  {error.replace('Error: ', '')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Rules */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            display: 'flex',
            gap: '1.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          {['S can be gulped by M or L', 'M can be gulped by L only', 'L cannot be gulped'].map((rule, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', maxWidth: '6rem' }}>
              <div style={{
                width: [14, 20, 28][i],
                height: [14, 20, 28][i],
                borderRadius: '50%',
                background: `rgba(37,99,235,${[0.4, 0.6, 0.8][i]})`,
                flexShrink: 0,
              }} />
              <span style={{ lineHeight: 1.3 }}>{rule}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
      style={{
        width: '1rem',
        height: '1rem',
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        display: 'inline-block',
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.8rem 1rem',
  borderRadius: '0.625rem',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text)',
  fontSize: '1rem',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '0.8rem 1rem',
  borderRadius: '0.625rem',
  border: 'none',
  fontWeight: 700,
  fontSize: '0.95rem',
  fontFamily: 'var(--font-display)',
  letterSpacing: '0.03em',
  transition: 'opacity 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
};
