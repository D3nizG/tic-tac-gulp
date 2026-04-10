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
import HowToPlayOverlay from './HowToPlayOverlay.js';
import type { PlayerId } from '@tic-tac-gulp/shared';

export default function GameView() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const lastMoveError = useGameStore((s) => s.lastMoveError);
  const [showOpponentOverlay, setShowOpponentOverlay] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

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
      <AnimatePresence>
        {showHowToPlay && <HowToPlayOverlay onClose={() => setShowHowToPlay(false)} />}
      </AnimatePresence>
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
          <button
            onClick={() => setShowHowToPlay(true)}
            title="How to play"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
              borderRadius: '50%', width: '1.625rem', height: '1.625rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
              fontFamily: 'var(--font-display)',
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(37,99,235,0.18)';
              e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            ?
          </button>
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
