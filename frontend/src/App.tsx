import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.js';

// Lazy-load RoomPage so Three.js / R3F only initializes when entering a room
const RoomPage = lazy(() => import('./pages/RoomPage.js'));

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'var(--bg)',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-display)',
      fontSize: '0.9rem',
      letterSpacing: '0.1em',
    }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/room/:code"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <RoomPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
