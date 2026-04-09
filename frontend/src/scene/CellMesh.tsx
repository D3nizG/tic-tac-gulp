import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Cell, PlayerId, PieceSize } from '@tic-tac-gulp/shared';
import PieceMesh from './PieceMesh.js';
import { cellToWorld } from './Board.js';

const CELL_SIZE = 1.7;
const PIECE_DIMS: Record<1 | 2 | 3, { h: number }> = {
  1: { h: 0.18 },
  2: { h: 0.26 },
  3: { h: 0.36 },
};

const PLAYER_COLORS: Record<PlayerId, string> = {
  P1: '#2563eb',
  P2: '#ea580c',
};

interface Props {
  cell: Cell;
  isValidTarget: boolean;
  isWinCell: boolean;
  isInvalidTarget: boolean;
  currentPlayer: PlayerId | null;
  selectedPieceSize: PieceSize | null;
  onClick: () => void;
  lastPlacedMoveCount?: number;
  currentMoveCount: number;
}

export default function CellMesh({
  cell,
  isValidTarget,
  isWinCell,
  isInvalidTarget,
  currentPlayer,
  selectedPieceSize,
  onClick,
  lastPlacedMoveCount,
  currentMoveCount,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const ghostRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const shakeRef = useRef(0);
  const shakeX = useRef(0);

  const [wx, , wz] = cellToWorld(cell.row, cell.col);

  // Compute stacked Y positions for each piece
  const stackYPositions: number[] = [];
  let cumY = 0.02; // just above board surface
  for (const piece of cell.stack) {
    cumY += PIECE_DIMS[piece.size as 1 | 2 | 3].h / 2;
    stackYPositions.push(cumY);
    cumY += PIECE_DIMS[piece.size as 1 | 2 | 3].h / 2 + 0.01;
  }

  // Win cell glow pulse
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      if (isWinCell) {
        mat.emissiveIntensity = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.2;
      } else {
        mat.emissiveIntensity = 0;
      }
    }

    // Ghost piece float
    if (ghostRef.current && isValidTarget && hovered) {
      ghostRef.current.position.y = 0.4 + Math.sin(clock.elapsedTime * 2.5) * 0.06;
    }

    // Invalid shake
    if (shakeRef.current > 0) {
      shakeRef.current -= 1;
      shakeX.current = Math.sin(shakeRef.current * 0.8) * 0.12;
    } else {
      shakeX.current = 0;
    }
  });

  function handleClick() {
    if (isInvalidTarget && cell.stack.length > 0) {
      shakeRef.current = 20;
    }
    onClick();
  }

  const ghostColor = currentPlayer ? PLAYER_COLORS[currentPlayer] : '#ffffff';
  const ghostSize = selectedPieceSize ?? 2;
  const ghostR = ghostSize === 1 ? 0.32 : ghostSize === 2 ? 0.42 : 0.54;
  const ghostH = ghostSize === 1 ? 0.18 : ghostSize === 2 ? 0.26 : 0.36;

  return (
    <group position={[wx + shakeX.current, 0, wz]}>
      {/* Invisible click plane */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
        position={[0, 0.02, 0]}
      >
        <boxGeometry args={[CELL_SIZE - 0.1, 0.08, CELL_SIZE - 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Cell surface tint (valid / win / hover) */}
      <mesh ref={glowRef} position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[CELL_SIZE - 0.08, 0.01, CELL_SIZE - 0.08]} />
        <meshStandardMaterial
          color={isWinCell ? '#fbbf24' : isValidTarget ? '#1e3a6e' : '#0f172a'}
          emissive={isWinCell ? '#fbbf24' : isValidTarget && hovered ? '#2563eb' : '#000000'}
          emissiveIntensity={0}
          transparent
          opacity={isWinCell ? 0.7 : isValidTarget ? (hovered ? 0.55 : 0.3) : 0}
          roughness={0.9}
        />
      </mesh>

      {/* Valid target ring */}
      {isValidTarget && (
        <mesh position={[0, 0.012, 0]}>
          <ringGeometry args={[CELL_SIZE * 0.38, CELL_SIZE * 0.46, 32]} />
          <meshBasicMaterial
            color={hovered ? '#fbbf24' : '#2a4a8a'}
            transparent
            opacity={hovered ? 0.9 : 0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Ghost piece on hover */}
      {isValidTarget && hovered && selectedPieceSize && (
        <mesh ref={ghostRef} position={[0, 0.4, 0]}>
          <cylinderGeometry args={[ghostR, ghostR, ghostH, 32]} />
          <meshStandardMaterial
            color={ghostColor}
            transparent
            opacity={0.35}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
      )}

      {/* Stacked pieces */}
      {cell.stack.map((piece, i) => {
        const isTop = i === cell.stack.length - 1;
        const isBuried = !isTop;
        const justPlaced = isTop && lastPlacedMoveCount === currentMoveCount - 1;
        return (
          <PieceMesh
            key={i}
            owner={piece.owner}
            size={piece.size as 1 | 2 | 3}
            position={[0, stackYPositions[i], 0]}
            buried={isBuried}
            isTop={isTop}
            justPlaced={justPlaced}
          />
        );
      })}
    </group>
  );
}
