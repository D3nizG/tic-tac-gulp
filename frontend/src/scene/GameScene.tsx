import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore.js';
import { getValidTargets } from '@tic-tac-gulp/shared';
import { emitMove } from '../stores/socketStore.js';
import Board from './Board.js';
import CellMesh from './CellMesh.js';
import CameraRig from './CameraRig.js';

export default function GameScene() {
  const gameState = useGameStore((s) => s.gameState);
  const yourPlayerId = useGameStore((s) => s.yourPlayerId);
  const selectedPieceSize = useGameStore((s) => s.selectedPieceSize);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const lastPlacedMoveCount = useGameStore((s) => s.lastPlacedMoveCount);

  if (!gameState || !yourPlayerId) return null;

  const { board, currentTurn, winLine, moveCount } = gameState;
  const isYourTurn = currentTurn === yourPlayerId;

  const validTargets =
    isYourTurn && selectedPieceSize !== null
      ? getValidTargets(gameState, yourPlayerId, selectedPieceSize)
      : [];

  const validSet = new Set(validTargets.map(([r, c]) => `${r},${c}`));
  const winSet = new Set((winLine ?? []).map(([r, c]) => `${r},${c}`));

  function handleCellClick(row: number, col: number) {
    if (selectedPieceSize === null) return;
    if (!validSet.has(`${row},${col}`)) return;
    emitMove(selectedPieceSize, row, col);
    selectPiece(null);
  }

  return (
    <Canvas
      camera={{ position: [0, 7, 5], fov: 45, near: 0.1, far: 100 }}
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping }}
      scene={{ background: new THREE.Color('#0a0f1e'), fog: new THREE.FogExp2('#0a0f1e', 0.038) }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.45} color="#8ba4d4" />
      <directionalLight
        position={[5, 12, 8]}
        intensity={1.4}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      {/* Subtle rim light from opposite side */}
      <directionalLight position={[-4, 6, -6]} intensity={0.3} color="#4a7abf" />
      <pointLight position={[0, 4, 0]} intensity={0.2} color="#c0d4ff" />

      {/* Environment for material reflections */}
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.3} />
      </Suspense>

      {/* Camera controls */}
      <CameraRig />

      {/* Board */}
      <Board />

      {/* Cells + pieces */}
      {board.map((rowArr, rIdx) =>
        rowArr.map((cell, cIdx) => {
          const key = `${rIdx},${cIdx}`;
          return (
            <CellMesh
              key={key}
              cell={cell}
              isValidTarget={validSet.has(key)}
              isWinCell={winSet.has(key)}
              isInvalidTarget={selectedPieceSize !== null && !validSet.has(key)}
              currentPlayer={isYourTurn ? yourPlayerId : null}
              selectedPieceSize={selectedPieceSize}
              onClick={() => handleCellClick(rIdx, cIdx)}
              lastPlacedMoveCount={lastPlacedMoveCount ?? undefined}
              currentMoveCount={moveCount}
            />
          );
        })
      )}
    </Canvas>
  );
}
