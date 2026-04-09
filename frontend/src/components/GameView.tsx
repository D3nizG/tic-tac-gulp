import { AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import GameScene from '../scene/GameScene.js';
import PlayerPanel from './PlayerPanel.js';
import TurnBadge from './TurnBadge.js';
import GameOverlay from './GameOverlay.js';
import ConnectionBanner from './ConnectionBanner.js';

export default function GameView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const lastMoveError = useGameStore((s) => s.lastMoveError);

  if (!gameState || !yourPlayerId) return null;

  const { currentTurn, status } = gameState;
  const isYourTurn = currentTurn === yourPlayerId;
  const opponent = yourPlayerId === 'P1' ? 'P2' : 'P1';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: 'var(--bg)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Disconnect/reconnect banner */}
      <ConnectionBanner />

      {/* Top area: opponent panel + turn badge */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.875rem 1rem 0.5rem',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <PlayerPanel playerId={opponent} isActive={currentTurn === opponent} />
        <TurnBadge />
        {lastMoveError && (
          <div style={{
            fontSize: '0.8rem',
            color: '#f87171',
            padding: '0.3rem 0.875rem',
            background: 'rgba(239,68,68,0.12)',
            borderRadius: '2rem',
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            {lastMoveError}
          </div>
        )}
      </div>

      {/* 3D Canvas — takes remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GameScene />
      </div>

      {/* Bottom area: your panel */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.5rem 1rem 0.875rem',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <PlayerPanel playerId={yourPlayerId} isActive={isYourTurn} isYou />
      </div>

      {/* Game over overlay */}
      <AnimatePresence>
        {status === 'ENDED' && <GameOverlay />}
      </AnimatePresence>
    </div>
  );
}
