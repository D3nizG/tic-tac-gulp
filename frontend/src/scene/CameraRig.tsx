import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

/**
 * Constrained camera rig — allows orbit around the board while keeping
 * the strategic top-down view readable. No pan, limited tilt.
 */
export default function CameraRig() {
  return (
    <OrbitControls
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      // Vertical tilt: ~10° above horizon to ~55° from zenith
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.48}
      // Zoom limits
      minDistance={6}
      maxDistance={14}
      // No horizontal rotation lock — free azimuth
      makeDefault
    />
  );
}
