import { useMemo } from 'react';
import * as THREE from 'three';

const BOARD_SIZE = 3;
const CELL_SIZE = 1.7;
const BOARD_EXTENT = CELL_SIZE * BOARD_SIZE; // 5.1
const BOARD_THICKNESS = 0.14;
const LINE_THICKNESS = 0.04;
const LINE_HEIGHT = 0.02;

/** Converts grid index [0..2] to world-space center position. */
export function cellToWorld(row: number, col: number): [number, number, number] {
  const offset = CELL_SIZE;
  const x = (col - 1) * offset;
  const z = (row - 1) * offset;
  return [x, 0, z];
}

export default function Board() {
  const boardMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#141c33',
        roughness: 0.85,
        metalness: 0.08,
      }),
    []
  );

  const lineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e2d4a',
        roughness: 0.9,
        metalness: 0.05,
      }),
    []
  );

  const edgeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 1,
        metalness: 0,
      }),
    []
  );

  return (
    <group>
      {/* Main board surface */}
      <mesh receiveShadow position={[0, -BOARD_THICKNESS / 2, 0]} material={boardMat}>
        <boxGeometry args={[BOARD_EXTENT + 0.4, BOARD_THICKNESS, BOARD_EXTENT + 0.4]} />
      </mesh>

      {/* Board edge bevel — bottom rim */}
      <mesh position={[0, -(BOARD_THICKNESS + 0.06) / 2 - BOARD_THICKNESS / 2, 0]} material={edgeMat}>
        <boxGeometry args={[BOARD_EXTENT + 0.7, 0.06, BOARD_EXTENT + 0.7]} />
      </mesh>

      {/* Vertical grid lines (run along Z axis) */}
      {[-CELL_SIZE / 2, CELL_SIZE / 2].map((xPos, i) => (
        <mesh key={`vline-${i}`} position={[xPos, LINE_HEIGHT / 2, 0]} material={lineMat}>
          <boxGeometry args={[LINE_THICKNESS, LINE_HEIGHT, BOARD_EXTENT + 0.1]} />
        </mesh>
      ))}

      {/* Horizontal grid lines (run along X axis) */}
      {[-CELL_SIZE / 2, CELL_SIZE / 2].map((zPos, i) => (
        <mesh key={`hline-${i}`} position={[0, LINE_HEIGHT / 2, zPos]} material={lineMat}>
          <boxGeometry args={[BOARD_EXTENT + 0.1, LINE_HEIGHT, LINE_THICKNESS]} />
        </mesh>
      ))}
    </group>
  );
}
