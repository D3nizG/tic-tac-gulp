import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.js';
import RoomPage from './pages/RoomPage.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
    </Routes>
  );
}
