import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { RoomSessionGuardProvider } from './rooms/RoomSessionGuardContext.jsx';
import { track } from './lib/analytics.js';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { ConsentPage } from './pages/ConsentPage.jsx';
import { NewRoomPage } from './pages/NewRoomPage.jsx';
import { JoinRoomPage } from './pages/JoinRoomPage.jsx';
import { MatchPage } from './pages/MatchPage.jsx';
import { LobbyPage } from './pages/LobbyPage.jsx';
import { HistoryPage } from './pages/HistoryPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

function App() {
  const location = useLocation();

  useEffect(() => {
    track('page_viewed', { path: location.pathname });
  }, [location.pathname]);

  return (
    <RoomSessionGuardProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/consent"
          element={
            <ProtectedRoute>
              <ConsentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/new"
          element={
            <ProtectedRoute>
              <NewRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/join"
          element={
            <ProtectedRoute>
              <JoinRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/match"
          element={
            <ProtectedRoute>
              <MatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rooms/:id"
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RoomSessionGuardProvider>
  );
}

export default App;
