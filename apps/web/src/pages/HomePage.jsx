import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function HomePage() {
  const { user, session, signOut } = useAuth();
  const [apiResult, setApiResult] = useState(null);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then(setApiResult)
      .catch((e) => setApiError(e.message));
  }, [session]);

  return (
    <section>
      <h1>Signed in</h1>
      <p>Supabase user: {user?.email}</p>
      <p>
        Backend /api/me:{' '}
        {apiResult ? `userId=${apiResult.userId}` : apiError ? `error: ${apiError}` : 'loading…'}
      </p>
      <p>
        <Link to="/consent">GD mic consent</Link>
      </p>
      <button type="button" onClick={() => signOut()}>
        Log out
      </button>
    </section>
  );
}
