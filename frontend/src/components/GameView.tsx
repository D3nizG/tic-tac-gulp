import { useGameStore } from '../stores/gameStore.js';
import GameBoard from './GameBoard.js';
import PlayerPanel from './PlayerPanel.js';
import GameOverOverlay from './GameOverOverlay.js';

export default function GameView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);

  if (!gameState || !yourPlayerId) return null;

  const { players, currentTurn, status } = gameState;
  const isYourTurn = currentTurn === yourPlayerId;
  const opponent = yourPlayerId === 'P1' ? 'P2' : 'P1';

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', padding: '1.5rem', position: 'relative' }}>

      {/* Turn indicator */}
      <div style={{
        padding: '0.5rem 1.5rem',
        borderRadius: '2rem',
        background: isYourTurn ? 'var(--highlight)' : 'var(--surface)',
        color: isYourTurn ? '#000' : 'var(--text-muted)',
        fontWeight: 700,
        fontSize: '0.95rem',
        transition: 'background 0.2s',
      }}>
        {isYourTurn ? 'Your turn' : `${players[currentTurn].displayName}'s turn`}
      </div>

      {/* Opponent panel */}
      <PlayerPanel playerId={opponent} isActive={currentTurn === opponent} />

      {/* Board */}
      <GameBoard />

      {/* Your panel */}
      <PlayerPanel playerId={yourPlayerId} isActive={isYourTurn} isYou />

      {/* Game over overlay */}
      {status === 'ENDED' && <GameOverOverlay />}
    </main>
  );
}
