import { useCallback, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Mirrors GET/POST /api/consent (W3, guardrail #3). Any screen that's about
// to enable a mic should check `canEnableMic` here first — false until the
// student has granted the current consent version.
export function useConsentStatus(session) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${API_URL}/api/consent/status`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((data) => {
        setStatus(data);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function grantConsent() {
    const res = await fetch(`${API_URL}/api/consent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    refresh();
  }

  return {
    canEnableMic: status?.canEnableMic ?? false,
    loading,
    error,
    grantConsent,
    refresh,
  };
}
