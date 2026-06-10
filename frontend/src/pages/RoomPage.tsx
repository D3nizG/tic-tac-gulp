import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore.js';
import { getSocket, leavePregameRoomIfNeeded } from '../stores/socketStore.js';
import LobbyView from '../components/LobbyView.js';
import GameView from '../components/GameView.js';

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const sessionId = useGameStore((s) => s.sessionId);
  const roomClosedReason = useGameStore((s) => s.roomClosedReason);
  const clearRoomClosedReason = useGameStore((s) => s.clearRoomClosedReason);

  useEffect(() => {
    if (!roomClosedReason) return;
    clearRoomClosedReason();
    navigate('/', { replace: true });
  }, [roomClosedReason, clearRoomClosedReason, navigate]);

  // Reconnect on page load if we have session info stored
  useEffect(() => {
    if (!code) return;
    const storedSession = localStorage.getItem('ttg_sessionId');
    const storedRoom = localStorage.getItem('ttg_roomCode');

    if (!sessionId && storedSession && storedRoom === code.toUpperCase()) {
      const socket = getSocket();
      if (!socket.connected) {
        socket.connect();
        socket.once('connect', () => {
          socket.emit('room:rejoin', { sessionId: storedSession, roomCode: code.toUpperCase() });
        });
      }
    }
  }, [code, sessionId]);

  useEffect(() => {
    window.addEventListener('popstate', leavePregameRoomIfNeeded);
    window.addEventListener('pagehide', leavePregameRoomIfNeeded);

    return () => {
      window.removeEventListener('popstate', leavePregameRoomIfNeeded);
      window.removeEventListener('pagehide', leavePregameRoomIfNeeded);
    };
  }, []);

  if (!code) {
    navigate('/');
    return null;
  }

  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Connecting...</p>
      </div>
    );
  }

  const isLobby = gameState.status === 'WAITING' || gameState.status === 'LOBBY';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isLobby ? <LobbyView /> : <GameView />}
    </div>
  );
}
