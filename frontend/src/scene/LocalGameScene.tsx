import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useLocalStore } from '../stores/localStore.js';
import { getValidTargets } from '@tic-tac-gulp/shared';
import Board from './Board.js';
import CellMesh from './CellMesh.js';
import CameraRig from './CameraRig.js';

export default function LocalGameScene() {
  const gameState = useLocalStore((s) => s.gameState);
  const viewSide = useLocalStore((s) => s.viewSide);
  const selectedPieceSize = useLocalStore((s) => s.selectedPieceSize);
  const selectPiece = useLocalStore((s) => s.selectPiece);
  const lastPlacedMoveCount = useLocalStore((s) => s.lastPlacedMoveCount);
  const applyLocalMove = useLocalStore((s) => s.applyLocalMove);

  if (!gameState) return null;

  const { board, currentTurn, winLine, moveCount } = gameState;
  const validTargets =
    selectedPieceSize !== null
      ? getValidTargets(gameState, currentTurn, selectedPieceSize)
      : [];

  const validSet = new Set(validTargets.map(([r, c]) => `${r},${c}`));
  const winSet = new Set((winLine ?? []).map(([r, c]) => `${r},${c}`));

  function handleCellClick(row: number, col: number) {
    if (selectedPieceSize === null) return;
    if (!validSet.has(`${row},${col}`)) return;
    applyLocalMove(selectedPieceSize, row, col);
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
      <ambientLight intensity={0.45} color="#8ba4d4" />
      <directionalLight
        position={[5, 12, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-4, 6, -6]} intensity={0.3} color="#4a7abf" />
      <pointLight position={[0, 4, 0]} intensity={0.2} color="#c0d4ff" />

      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.3} />
      </Suspense>

      {/* Camera switches perspective after each pass */}
      <CameraRig playerSide={viewSide} />

      <Board />

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
              currentPlayer={currentTurn}
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
