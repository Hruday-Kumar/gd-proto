import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { createRoom, generateTopic, submitCustomTopic } from '../rooms/roomsApi.js';
import { AppShell } from '../components/AppShell.jsx';
import { ButtonBusyLabel } from '../components/ButtonBusyLabel.jsx';
import { DurationPicker } from '../components/DurationPicker.jsx';

// 10 minutes -- a pre-filled UI default only (the student can change it
// before creating the room), anchored to the example durations the
// product doc gives for GD practice ("5 or 10 minutes").
const DEFAULT_DURATION_SECONDS = 600;

export function NewRoomPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [customText, setCustomText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function createAndEnter(topic) {
    const room = await createRoom(session, { topicId: topic.id, durationSeconds });
    navigate(`/rooms/${room.id}`, {
      state: { code: room.code, status: room.status, isCreator: true, topicText: topic.text },
    });
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const topic = await generateTopic(session);
      await createAndEnter(topic);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCustomSubmit(e) {
    e.preventDefault();
    if (!customText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const topic = await submitCustomTopic(session, { text: customText.trim() });
      await createAndEnter(topic);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Create a room" subtitle="Pick a topic and share the room code with classmates to get started.">
      <div className="mb-6 rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
        <DurationPicker valueSeconds={durationSeconds} onChange={setDurationSeconds} disabled={busy} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
            <span className="material-symbols-outlined text-on-primary-container">auto_awesome</span>
          </div>
          <h3 className="text-headline-sm font-semibold text-on-surface">Generate a topic for me</h3>
          <p className="mt-1 flex-1 text-body-sm text-text-secondary">
            Get an AI-generated GD topic and jump straight into a new room.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <ButtonBusyLabel label="Working…" /> : 'Generate & create room'}
          </button>
        </div>

        <div className="flex flex-col rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container">
            <span className="material-symbols-outlined text-on-surface">edit_note</span>
          </div>
          <h3 className="text-headline-sm font-semibold text-on-surface">Bring your own topic</h3>
          <p className="mt-1 text-body-sm text-text-secondary">Enter a topic and we'll create the room for it.</p>
          <form onSubmit={handleCustomSubmit} className="mt-6 flex flex-1 flex-col justify-end gap-3">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              disabled={busy}
              placeholder="e.g. Should college attendance be mandatory?"
              maxLength={200}
              className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={busy || !customText.trim()}
              className="flex items-center justify-center gap-2 rounded-lg border border-primary py-3 text-label-md font-semibold text-primary transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <ButtonBusyLabel label="Creating…" /> : 'Create room with this topic'}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
          {error}
        </p>
      )}
    </AppShell>
  );
}
