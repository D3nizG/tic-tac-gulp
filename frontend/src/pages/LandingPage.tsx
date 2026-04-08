import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore.js';
import { getSocket } from '../stores/socketStore.js';

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
      const res = await fetch('/api/rooms', {
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
      const res = await fetch(`/api/rooms/${code}/join`, {
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
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '2rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
        Tic-Tac-<span style={{ color: 'var(--p2-primary)' }}>Gulp</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '28rem', textAlign: 'center' }}>
        A strategic twist on tic-tac-toe. Stack larger pieces to gulp smaller ones. Get 3 in a row to win.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '22rem' }}>
        <input
          type="text"
          placeholder="Your display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={16}
          style={inputStyle}
        />

        {mode === 'idle' && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleCreate} disabled={!nameValid || loading} style={{ ...btnStyle, background: 'var(--p1-primary)', flex: 1 }}>
              {loading ? '...' : 'Create Game'}
            </button>
            <button onClick={() => setMode('join')} disabled={!nameValid} style={{ ...btnStyle, background: 'var(--surface)', border: '1px solid var(--border)', flex: 1 }}>
              Join Game
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Room code (6 characters)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setMode('idle')} style={{ ...btnStyle, background: 'var(--surface)', border: '1px solid var(--border)', flex: 1 }}>
                Back
              </button>
              <button onClick={handleJoin} disabled={!nameValid || joinCode.trim().length !== 6 || loading} style={{ ...btnStyle, background: 'var(--p2-primary)', flex: 1 }}>
                {loading ? '...' : 'Join'}
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{error}</p>}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: '1rem',
  outline: 'none',
  width: '100%',
};

const btnStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  color: '#fff',
  fontWeight: 600,
  fontSize: '1rem',
  transition: 'opacity 0.15s',
};
