import { useGameStore } from '../stores/gameStore.js';
import { emitStartGame } from '../stores/socketStore.js';

export default function LobbyView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);

  if (!gameState) return null;

  const { players, roomCode } = gameState;
  const isHost = yourPlayerId === 'P1';
  const p2Joined = players.P2.displayName !== '';
  const canStart = isHost && p2Joined;

  function copyCode() {
    navigator.clipboard.writeText(roomCode).catch(() => {});
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '2rem', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Lobby</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Room Code</p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--highlight)' }}>
            {roomCode}
          </span>
          <button onClick={copyCode} style={{ padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem' }}>
            Copy
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Share this code with your opponent</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <PlayerSlot name={players.P1.displayName} color="var(--p1-primary)" label="P1 · Blue" isYou={yourPlayerId === 'P1'} />
        <PlayerSlot name={p2Joined ? players.P2.displayName : null} color="var(--p2-primary)" label="P2 · Orange" isYou={yourPlayerId === 'P2'} />
      </div>

      {isHost ? (
        <button
          onClick={emitStartGame}
          disabled={!canStart}
          style={{
            padding: '0.875rem 2.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: canStart ? 'var(--p1-primary)' : 'var(--border)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: canStart ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {canStart ? 'Start Game' : 'Waiting for opponent...'}
        </button>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Waiting for the host to start the game...</p>
      )}
    </main>
  );
}

function PlayerSlot({ name, color, label, isYou }: { name: string | null; color: string; label: string; isYou: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 2rem', borderRadius: '0.75rem', background: 'var(--surface)', border: `2px solid ${name ? color : 'var(--border)'}`, minWidth: '10rem' }}>
      <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: name ? color : 'var(--border)' }} />
      <p style={{ fontWeight: 700, fontSize: '1rem' }}>{name ?? '—'}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}{isYou ? ' (You)' : ''}</p>
    </div>
  );
}
