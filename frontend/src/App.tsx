import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.js';
import InviteToast from './components/InviteToast.js';
import { useAuthStore } from './stores/authStore.js';

// Lazy-load heavy pages so Three.js / R3F only initializes when needed
const RoomPage = lazy(() => import('./pages/RoomPage.js'));
const LocalGamePage = lazy(() => import('./pages/LocalGamePage.js'));
const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.js'));

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

function OwnProfileRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />;
  // Redirect to /profile after username is known (ProfilePage handles the /profile case too)
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProfilePage />
    </Suspense>
  );
}

export default function App() {
  return (
    <>
    <InviteToast />
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
      <Route
        path="/local"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <LocalGamePage />
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route path="/profile" element={<OwnProfileRedirect />} />
      <Route
        path="/profile/:username"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <ProfilePage />
          </Suspense>
        }
      />
    </Routes>
    </>
  );
}
