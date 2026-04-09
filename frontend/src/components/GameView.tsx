import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/gameStore.js';
import GameScene from '../scene/GameScene.js';
import PlayerPanel from './PlayerPanel.js';
import TurnBadge from './TurnBadge.js';
import GameOverlay from './GameOverlay.js';
import ConnectionBanner from './ConnectionBanner.js';
import GameTimer from './GameTimer.js';
import ResignButton from './ResignButton.js';
import ChatPanel from './ChatPanel.js';
import OpponentOverlay from './OpponentOverlay.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

export default function GameView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const lastMoveError = useGameStore((s) => s.lastMoveError);
  const [showOpponentOverlay, setShowOpponentOverlay] = useState(false);

  if (!gameState || !yourPlayerId) return null;

  const { currentTurn, status } = gameState;
  const isYourTurn = currentTurn === yourPlayerId;
  const opponent = (yourPlayerId === 'P1' ? 'P2' : 'P1') as PlayerId;

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

      {/* Top area: opponent panel + turn badge + timer */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.875rem 1rem 0.5rem',
        flexShrink: 0,
        zIndex: 10,
        position: 'relative',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '26rem' }}>
          <PlayerPanel
            playerId={opponent}
            isActive={currentTurn === opponent}
            onInfoClick={() => setShowOpponentOverlay((v) => !v)}
          />
          <AnimatePresence>
            {showOpponentOverlay && (
              <OpponentOverlay
                opponentId={opponent}
                onClose={() => setShowOpponentOverlay(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Turn badge + timer row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <TurnBadge />
          <GameTimer />
        </div>

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

      {/* Bottom area: your panel + resign + chat */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.5rem 1rem 0.875rem',
        flexShrink: 0,
        zIndex: 10,
        gap: '0.5rem',
      }}>
        <PlayerPanel playerId={yourPlayerId} isActive={isYourTurn} isYou />

        {/* Controls row: resign (left) + chat (right) */}
        {(status === 'IN_PROGRESS' || status === 'ENDED') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '26rem',
            paddingInline: '0.25rem',
          }}>
            <ResignButton />
            <ChatPanel />
          </div>
        )}
      </div>

      {/* Game over overlay */}
      <AnimatePresence>
        {status === 'ENDED' && <GameOverlay />}
      </AnimatePresence>
    </div>
  );
}
