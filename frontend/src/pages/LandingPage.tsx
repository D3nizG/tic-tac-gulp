import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore.js';
import { getSocket } from '../stores/socketStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { supabaseEnabled } from '../lib/supabase.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, signInWithGoogle, signOut, getToken } = useAuthStore();
  const [usernamePrompt, setUsernamePrompt] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [profile, setProfile] = useState<{ username: string } | null>(null);

  // When user signs in, check if they have a profile; if not, prompt for username
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    const token = getToken();
    fetch(`${SOCKET_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.username) {
          setProfile(data);
          // Pre-fill display name with their username
          setDisplayName(data.username);
        } else {
          setUsernamePrompt(true);
        }
      })
      .catch(() => setUsernamePrompt(true));
  }, [user]);

  async function handleSetUsername() {
    const trimmed = usernameInput.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return;
    setUsernameLoading(true);
    setUsernameError('');
    const token = getToken();
    try {
      const res = await fetch(`${SOCKET_URL}/api/users/me`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUsernameError(data.error ?? 'Failed to save username.');
        return;
      }
      setProfile(data);
      setDisplayName(trimmed);
      setUsernamePrompt(false);
    } catch {
      setUsernameError('Network error. Please try again.');
    } finally {
      setUsernameLoading(false);
    }
  }

  const nameValid = displayName.trim().length >= 3 && displayName.trim().length <= 16;

  async function handleCreate() {
    if (!nameValid) return;
    setLoading(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create room.');
      const { roomCode, playerId, sessionId } = await res.json();

      setSession(playerId, roomCode, sessionId);
      localStorage.setItem('ttg_sessionId', sessionId);
      localStorage.setItem('ttg_roomCode', roomCode);

      const socket = getSocket();
      if (socket.connected) {
        socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
      } else {
        socket.connect();
        socket.once('connect', () => {
          socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
        });
      }

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
    const token = getToken();
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms/${code}/join`, {
        method: 'POST',
        headers: authHeaders(token),
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
      if (socket.connected) {
        socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
      } else {
        socket.connect();
        socket.once('connect', () => {
          socket.emit('room:join', { sessionId, roomCode, displayName: displayName.trim(), playerId });
        });
      }

      navigate(`/room/${roomCode}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    {/* Username setup modal — shown on first sign-in */}
    <AnimatePresence>
      {usernamePrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            style={{
              background: 'rgba(20,28,51,0.97)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '22rem',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
              Choose a username
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
              This is how other players will see you.
            </p>
            <input
              type="text"
              placeholder="Username (3–20 chars)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              style={{ ...inputStyle, marginBottom: '0.75rem' }}
            />
            {usernameError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 0.75rem',
                padding: '0.4rem 0.6rem', background: 'rgba(239,68,68,0.1)',
                borderRadius: '0.375rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                {usernameError}
              </p>
            )}
            <button
              onClick={handleSetUsername}
              disabled={usernameInput.trim().length < 3 || usernameLoading}
              style={{
                ...btnStyle, width: '100%',
                background: usernameInput.trim().length >= 3
                  ? 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)'
                  : 'rgba(37,99,235,0.2)',
                color: usernameInput.trim().length >= 3 ? '#fff' : 'rgba(255,255,255,0.35)',
                cursor: usernameInput.trim().length >= 3 && !usernameLoading ? 'pointer' : 'not-allowed',
              }}
            >
              {usernameLoading ? <Spinner /> : 'Save Username'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

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
          initial={{ y: -16 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          style={{ textAlign: 'center' }}
        >
          <h1
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
          </h1>
          <p
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
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ y: 20, scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.06 }}
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

            {/* Mode toggle / join input */}
            <AnimatePresence mode="wait">
              {mode === 'idle' ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
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

        {/* Local play shortcut */}
        <motion.button
          onClick={() => navigate('/local')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.03em',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          {/* Two-person icon */}
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <circle cx="4.5" cy="3" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M0.5 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="10.5" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
            <path d="M9 10.5c.4-1.6 1.8-2.8 3.3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
          </svg>
          Play Locally (2 players, same device)
        </motion.button>

        {/* Auth — optional sign-in for career stats */}
        {supabaseEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          >
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <div style={{
                  width: '1.75rem', height: '1.75rem', borderRadius: '50%',
                  background: 'var(--p1-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {user.email?.[0].toUpperCase() ?? '?'}
                </div>
                <span style={{ color: 'var(--text)' }}>{profile?.username ?? user.email}</span>
                <button
                  onClick={signOut}
                  style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem',
                    color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem 0.6rem',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderRadius: '2rem',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google to track career stats
              </button>
            )}
          </motion.div>
        )}

        {/* Rules */}
        <div
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
        </div>
      </div>
    </main>
    </>
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
