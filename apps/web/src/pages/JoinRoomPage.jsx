import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { joinRoomByCode } from '../rooms/roomsApi.js';
import { AppShell } from '../components/AppShell.jsx';
import { ButtonBusyLabel } from '../components/ButtonBusyLabel.jsx';

export function JoinRoomPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const room = await joinRoomByCode(session, code.trim().toUpperCase());
      navigate(`/rooms/${room.id}`, { state: { code: room.code, status: room.status, isCreator: false } });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Join a room by code" subtitle="Enter the code a classmate shared with you.">
      <div className="mx-auto max-w-md rounded-xl border border-border-base bg-surface-container-lowest p-12 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-container">
          <span className="material-symbols-outlined text-on-primary-container">meeting_room</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-label-md font-semibold text-on-surface" htmlFor="code">
              Room code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
              placeholder="e.g. 7K4PQ"
              autoCapitalize="characters"
              className="mt-2 w-full rounded-lg border border-border-base bg-surface px-3 py-3 text-center text-headline-sm font-semibold uppercase tracking-widest text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <ButtonBusyLabel label="Joining…" /> : 'Join room'}
          </button>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
              {error}
            </p>
          )}
        </form>
      </div>
    </AppShell>
  );
}
