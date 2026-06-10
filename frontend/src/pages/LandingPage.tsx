import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { joinRoomSession } from '../stores/socketStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { supabaseEnabled } from '../lib/supabase.js';
import { useFriendsStore } from '../stores/friendsStore.js';
import FriendsPanel from '../components/FriendsPanel.js';
import HowToPlayOverlay from '../components/HowToPlayOverlay.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

interface LobbyProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function LandingPage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, signOut, getToken, loading: authLoading } = useAuthStore();
  const { pendingIn, fetchRequests, sendGameInvite } = useFriendsStore();
  const [usernamePrompt, setUsernamePrompt] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [profile, setProfile] = useState<LobbyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // When user signs in, check if they have a profile; if not, prompt for username.
  // Auth failures should not block the guest display-name flow.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileChecked(true);
      setUsernamePrompt(false);
      return;
    }
    const token = getToken();
    setProfileChecked(false);
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      setProfileChecked(true);
      setUsernamePrompt(false);
      return;
    }
    setProfileLoading(true);
    fetch(`${SOCKET_URL}/api/users/me`, { headers: authHeaders(token) })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, data };
      })
      .then((data) => {
        if (data.ok && data.data.username) {
          setProfile(data.data);
          // Pre-fill display name with their username
          setDisplayName(data.data.username);
          setUsernamePrompt(false);
        } else if (data.status === 404 && data.data.code === 'PROFILE_NOT_FOUND') {
          setProfile(null);
          setUsernamePrompt(true);
        } else {
          setProfile(null);
          setUsernamePrompt(false);
          setError('Signed in, but the game API rejected the session.');
        }
      })
      .catch(() => setUsernamePrompt(false))
      .finally(() => {
        setProfileLoading(false);
        setProfileChecked(true);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    fetchRequests();
    const interval = window.setInterval(fetchRequests, 3500);
    return () => window.clearInterval(interval);
  }, [user?.id, fetchRequests]);

  async function handleSetUsername() {
    const trimmed = usernameInput.trim();
    if (trimmed.length < 3 || trimmed.length > 20) return;
    setUsernameLoading(true);
    setUsernameError('');
    const token = getToken();
    if (!token) {
      setUsernameError('Sign in again to save a profile username.');
      setUsernameLoading(false);
      return;
    }
    try {
      const res = await fetch(`${SOCKET_URL}/api/users/me`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setDisplayName(trimmed.slice(0, 16));
          setUsernamePrompt(false);
          setError('Profile sign-in is unavailable. You can still play as a guest.');
          return;
        }
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

  const effectiveDisplayName = user ? profile?.username ?? '' : displayName.trim();
  const nameValid = authLoading
    ? false
    : user
    ? Boolean(profile?.username && profileChecked && !profileLoading)
    : displayName.trim().length >= 3 && displayName.trim().length <= 16;

  async function handleCreate() {
    if (!nameValid) return;
    setLoading(true);
    setError('');
    const token = getToken();
    const displayNameForGame = effectiveDisplayName;
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: displayNameForGame }),
      });
      if (!res.ok) throw new Error('Failed to create room.');
      const { roomCode, playerId, sessionId } = await res.json();

      joinRoomSession(roomCode, playerId, sessionId, displayNameForGame);
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
    const displayNameForGame = effectiveDisplayName;
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms/${code}/join`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: displayNameForGame }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? 'Failed to join room.');
      }
      const { roomCode, playerId, sessionId } = await res.json();

      joinRoomSession(roomCode, playerId, sessionId, displayNameForGame);
      navigate(`/room/${roomCode}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleChallenge(username: string): Promise<{ error: string | null }> {
    if (!profile?.username) return { error: 'Set a username first.' };
    setLoading(true);
    setError('');
    const token = getToken();
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: profile.username }),
      });
      const roomData = await res.json();
      if (!res.ok) return { error: roomData.error ?? 'Failed to create room.' };

      const invite = await sendGameInvite(username, roomData.roomCode);
      if (invite.error) return invite;

      joinRoomSession(roomData.roomCode, roomData.playerId, roomData.sessionId, profile.username);
      navigate(`/room/${roomData.roomCode}`);
      return { error: null };
    } catch {
      return { error: 'Failed to challenge friend.' };
    } finally {
      setLoading(false);
    }
  }

  async function handleFindGame() {
    if (!nameValid) return;
    setLoading(true);
    setError('');
    const token = getToken();
    const displayNameForGame = effectiveDisplayName;
    try {
      const res = await fetch(`${SOCKET_URL}/api/rooms/search`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ displayName: displayNameForGame }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to find a game.');

      joinRoomSession(data.roomCode, data.playerId, data.sessionId, displayNameForGame);
      navigate(`/room/${data.roomCode}`);
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

    <AnimatePresence>
      {showFriends && (
        <FriendsPanel
          onClose={() => setShowFriends(false)}
          onChallenge={handleChallenge}
        />
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showHowToPlay && <HowToPlayOverlay onClose={() => setShowHowToPlay(false)} />}
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

      {supabaseEnabled && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.625rem',
        }}>
          {authLoading ? null : user ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.45rem 0.5rem 0.45rem 0.45rem',
                borderRadius: '999px',
                background: 'rgba(20,28,51,0.86)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 18px 36px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(12px)',
              }}>
                <Link
                  to={profile?.username ? `/profile/${profile.username}` : '#'}
                  onClick={(e) => {
                    if (!profile?.username) {
                      e.preventDefault();
                      setUsernamePrompt(true);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    color: 'var(--text)',
                    textDecoration: 'none',
                  }}
                >
                  <InitialAvatar name={profile?.username ?? 'Player'} size={32} />
                  <span style={{
                    maxWidth: '9rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                  }}>
                    {profile?.username ?? (profileLoading ? 'Loading…' : 'Set username')}
                  </span>
                </Link>
                <button
                  onClick={signOut}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '999px',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    padding: '0.25rem 0.55rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Sign out
                </button>
              </div>
              <button
                onClick={() => setShowFriends(true)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 0.85rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(20,28,51,0.78)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  boxShadow: '0 18px 36px rgba(0,0,0,0.24)',
                }}
              >
                Friends
                {pendingIn.length > 0 && (
                  <span style={{
                    minWidth: 17,
                    height: 17,
                    borderRadius: '999px',
                    background: 'var(--p2-primary)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingInline: '0.25rem',
                  }}>
                    {pendingIn.length}
                  </span>
                )}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              style={{
                padding: '0.55rem 0.95rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(20,28,51,0.78)',
                color: 'var(--text)',
                fontSize: '0.8rem',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          )}
        </div>
      )}

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
            {!user && !authLoading && (
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
            )}
            {user && profileChecked && !profileLoading && !profile?.username && (
              <button
                onClick={() => setUsernamePrompt(true)}
                style={{
                  ...btnStyle,
                  width: '100%',
                  background: 'rgba(37,99,235,0.14)',
                  border: '1px solid rgba(37,99,235,0.35)',
                  color: '#bfdbfe',
                  cursor: 'pointer',
                }}
              >
                Finish Profile Setup
              </button>
            )}

            {/* Mode toggle / join input */}
            <AnimatePresence mode="wait">
              {mode === 'idle' ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}
                >
                  <motion.button
                    onClick={handleCreate}
                    disabled={!nameValid || loading}
                    whileHover={nameValid ? { scale: 1.02 } : {}}
                    whileTap={nameValid ? { scale: 0.97 } : {}}
                    style={{
                      ...btnStyle,
                      fontSize: '0.82rem',
                      background: nameValid
                        ? 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)'
                        : 'rgba(37,99,235,0.2)',
                      color: nameValid ? '#fff' : 'rgba(255,255,255,0.35)',
                      cursor: nameValid && !loading ? 'pointer' : 'not-allowed',
                      boxShadow: nameValid ? '0 0 16px rgba(37,99,235,0.35)' : 'none',
                    }}
                  >
                    {loading ? <Spinner /> : 'Create Private'}
                  </motion.button>
                  <motion.button
                    onClick={() => setMode('join')}
                    disabled={!nameValid || loading}
                    whileHover={nameValid && !loading ? { scale: 1.02 } : {}}
                    whileTap={nameValid && !loading ? { scale: 0.97 } : {}}
                    style={{
                      ...btnStyle,
                      fontSize: '0.82rem',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: nameValid ? 'var(--text)' : 'var(--text-muted)',
                      cursor: nameValid && !loading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Join Private
                  </motion.button>
                  <motion.button
                    onClick={handleFindGame}
                    disabled={!nameValid || loading}
                    whileHover={nameValid ? { scale: 1.02 } : {}}
                    whileTap={nameValid ? { scale: 0.97 } : {}}
                    style={{
                      ...btnStyle,
                      fontSize: '0.82rem',
                      background: nameValid
                        ? 'linear-gradient(135deg, var(--p2-primary) 0%, #c2410c 100%)'
                        : 'rgba(234,88,12,0.2)',
                      color: nameValid ? '#fff' : 'rgba(255,255,255,0.35)',
                      cursor: nameValid && !loading ? 'pointer' : 'not-allowed',
                      boxShadow: nameValid ? '0 0 16px rgba(234,88,12,0.28)' : 'none',
                    }}
                  >
                    {loading ? <Spinner /> : 'Find Game'}
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

        <motion.button
          onClick={() => setShowHowToPlay(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '2rem',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.03em',
            marginTop: '-2.25rem',
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
          ?
          How to Play
        </motion.button>

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

function InitialAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--p1-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: size * 0.4,
      flexShrink: 0,
      boxShadow: '0 0 16px rgba(37,99,235,0.35)',
    }}>
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
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
