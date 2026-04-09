import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerId, PieceSize } from '@tic-tac-gulp/shared';

const PLAYER_COLORS: Record<PlayerId, string> = {
  P1: '#2563eb',
  P2: '#ea580c',
};

const PIECE_DIMS: Record<PieceSize, { r: number; h: number }> = {
  1: { r: 0.32, h: 0.18 },
  2: { r: 0.42, h: 0.26 },
  3: { r: 0.54, h: 0.36 },
};

interface Props {
  owner: PlayerId;
  size: PieceSize;
  /** World-space [x,y,z] resting position (top surface of stack below this piece) */
  position: [number, number, number];
  /** Whether this piece is buried under another — render as semi-transparent ring */
  buried?: boolean;
  /** Whether this piece is the topmost visible piece */
  isTop?: boolean;
  /** Trigger drop animation (piece was just placed) */
  justPlaced?: boolean;
}

export default function PieceMesh({ owner, size, position, buried = false, isTop = true, justPlaced = false }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { r, h } = PIECE_DIMS[size];
  const color = PLAYER_COLORS[owner];

  // Animate Y from drop height to resting position
  const dropY = useRef(justPlaced ? position[1] + 3.5 : position[1]);
  const restY = position[1];

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    const current = dropY.current;
    if (Math.abs(current - restY) > 0.001) {
      // Spring-like lerp toward rest
      dropY.current = THREE.MathUtils.lerp(current, restY, 1 - Math.pow(0.005, delta));
      meshRef.current.position.y = dropY.current;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], dropY.current, position[2]]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[r, r, h, 40]} />
      {buried ? (
        // Buried pieces: show as a faint ring outline
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.18}
          roughness={0.6}
          metalness={0.2}
          wireframe={false}
          side={THREE.FrontSide}
        />
      ) : (
        <meshStandardMaterial
          color={color}
          roughness={0.38}
          metalness={0.28}
          envMapIntensity={0.8}
          emissive={isTop ? color : '#000000'}
          emissiveIntensity={isTop ? 0.06 : 0}
        />
      )}
    </mesh>
  );
}
