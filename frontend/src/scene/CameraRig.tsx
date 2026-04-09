import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface Props {
  /** Which side of the board to start from. P1 = positive Z, P2 = negative Z. */
  playerSide?: 'P1' | 'P2';
}

/**
 * Constrained camera rig. Starts from the player's own side of the board
 * so P1 and P2 naturally face each other across the grid.
 */
export default function CameraRig({ playerSide = 'P1' }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    const z = playerSide === 'P2' ? -5 : 5;
    camera.position.set(0, 7, z);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [playerSide, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.48}
      minDistance={6}
      maxDistance={14}
      makeDefault
    />
  );
}
