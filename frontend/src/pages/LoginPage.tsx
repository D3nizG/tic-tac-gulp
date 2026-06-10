import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { supabaseEnabled } from '../lib/supabase.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, getToken } = useAuthStore();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Username setup
  const [usernamePrompt, setUsernamePrompt] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  const from = (location.state as { from?: string })?.from ?? '/';

  // When user signs in, check for existing profile.
  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) {
      setError('Sign-in session is not ready yet. Try again in a moment.');
      return;
    }
    fetch(`${SOCKET_URL}/api/users/me`, {
      headers: authHeaders(token),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, data };
      })
      .then((data) => {
        if (data.ok && data.data.username) {
          navigate(from, { replace: true });
        } else if (data.status === 404 && data.data.code === 'PROFILE_NOT_FOUND') {
          setUsernamePrompt(true);
        } else if (data.status === 401) {
          setUsernamePrompt(false);
          setError('Sign-in worked, but the game API rejected the session.');
        } else {
          setUsernamePrompt(false);
          setError('Could not load your profile.');
        }
      })
      .catch(() => {
        setUsernamePrompt(false);
        setError('Could not reach the game API.');
      });
  }, [user]);

  async function handleEmailAuth() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    setSuccess('');
    const fn = tab === 'signin' ? signInWithEmail : signUpWithEmail;
    const { error: err } = await fn(email.trim(), password);
    if (err) {
      setError(err);
    } else if (tab === 'signup') {
      setSuccess('Check your email to confirm your account, then sign in.');
    }
    setLoading(false);
  }

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
          setUsernameError('The game API rejected this session. Check backend Supabase config.');
          return;
        }
        setUsernameError(data.error ?? 'Failed to save username.');
        return;
      }
      void data;
      navigate(from, { replace: true });
    } catch {
      setUsernameError('Network error. Please try again.');
    } finally {
      setUsernameLoading(false);
    }
  }

  return (
    <>
      {/* Username setup modal */}
      <AnimatePresence>
        {usernamePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              style={{
                background: 'rgba(12,18,40,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1.25rem', padding: '2rem',
                width: '100%', maxWidth: '22rem',
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
                <p style={{
                  color: '#f87171', fontSize: '0.8rem', margin: '0 0 0.75rem',
                  padding: '0.4rem 0.6rem', background: 'rgba(239,68,68,0.1)',
                  borderRadius: '0.375rem', border: '1px solid rgba(239,68,68,0.2)',
                }}>
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
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: '22rem', zIndex: 1 }}>
          {/* Back link */}
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '0.8rem', cursor: 'pointer', marginBottom: '2rem',
              fontFamily: 'var(--font-body)', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </motion.button>

          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            style={{ marginBottom: '2rem' }}
          >
            <h1 style={{
              fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em', margin: '0 0 0.375rem',
            }}>
              Sign in
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Track your career stats and find friends.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.06 }}
            style={{
              background: 'rgba(20,28,51,0.8)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '1.5rem',
              padding: '1.75rem',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
            }}
          >
            {/* Current signed-in user banner */}
            {user && !usernamePrompt && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', marginBottom: '1.25rem',
                background: 'rgba(37,99,235,0.1)',
                border: '1px solid rgba(37,99,235,0.25)',
                borderRadius: '0.75rem',
                fontSize: '0.85rem',
              }}>
                <span>Signed in</span>
                <button
                  onClick={signOut}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  Sign out
                </button>
              </div>
            )}

            {!supabaseEnabled && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                Auth is not configured in this environment.
              </p>
            )}

            {/* Google OAuth */}
            <button
              onClick={signInWithGoogle}
              disabled={!supabaseEnabled}
              style={{
                ...btnStyle, width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)',
                cursor: supabaseEnabled ? 'pointer' : 'not-allowed',
                marginBottom: '1.25rem',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { if (supabaseEnabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Tab selector */}
            <div style={{
              display: 'flex', gap: '0.25rem',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '0.625rem', padding: '0.25rem',
              marginBottom: '1rem',
            }}>
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: tab === t ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--p1-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--p1-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{
                      color: '#f87171', fontSize: '0.8rem', margin: 0,
                      padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)',
                      borderRadius: '0.5rem', border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    {error}
                  </motion.p>
                )}
                {success && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{
                      color: '#4ade80', fontSize: '0.8rem', margin: 0,
                      padding: '0.5rem 0.75rem', background: 'rgba(74,222,128,0.1)',
                      borderRadius: '0.5rem', border: '1px solid rgba(74,222,128,0.2)',
                    }}
                  >
                    {success}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                onClick={handleEmailAuth}
                disabled={!supabaseEnabled || !email.trim() || !password || loading}
                style={{
                  ...btnStyle,
                  background: (email.trim() && password)
                    ? 'linear-gradient(135deg, var(--p1-primary) 0%, #1d4ed8 100%)'
                    : 'rgba(37,99,235,0.2)',
                  color: (email.trim() && password) ? '#fff' : 'rgba(255,255,255,0.35)',
                  cursor: (email.trim() && password && !loading && supabaseEnabled) ? 'pointer' : 'not-allowed',
                  boxShadow: (email.trim() && password) ? '0 0 14px rgba(37,99,235,0.35)' : 'none',
                }}
              >
                {loading ? <Spinner /> : tab === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </motion.div>

          {/* Guest link */}
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}
          >
            Just want to play?{' '}
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none', border: 'none', color: 'var(--highlight)',
                cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)',
                textDecoration: 'underline', padding: 0,
              }}
            >
              Continue as guest
            </button>
          </motion.p>
        </div>
      </main>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
      style={{
        width: '1rem', height: '1rem', borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff', display: 'inline-block',
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
};
