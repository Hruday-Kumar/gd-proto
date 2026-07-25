import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SignupPage } from './pages/SignupPage.jsx';
import { ConsentPage } from './pages/ConsentPage.jsx';

function App() {
  return (
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
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
