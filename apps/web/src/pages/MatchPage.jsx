import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getActiveRoom, leaveMatchQueue, requestMatch } from '../rooms/roomsApi.js';
import { AppShell } from '../components/AppShell.jsx';
import { DurationPicker } from '../components/DurationPicker.jsx';

const DEFAULT_DURATION_SECONDS = 600; // see NewRoomPage.jsx for why
const QUEUE_POLL_INTERVAL_MS = 4000;
// A room needs three students before it can form. At pilot scale there
// often aren't three people online at once, so waiting silently forever is
// the likeliest outcome, not the edge case -- give up out loud instead and
// point at the path that always works (create a room, share the code).
const MAX_QUEUE_WAIT_MS = 90000;

export function MatchPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const giveUpRef = useRef(null);
  // Read through a ref so the unmount cleanup below doesn't need `session`
  // in its dependency array -- Supabase swaps the session object on every
  // token refresh, which would otherwise re-run cleanup mid-queue.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const stopWaiting = useCallback(() => {
    clearInterval(pollRef.current);
    clearTimeout(giveUpRef.current);
  }, []);

  // Leaving the queue on unmount matters: a stale row can otherwise match
  // this student into a room they've navigated away from, which wastes the
  // whole group's session, not just theirs.
  useEffect(() => {
    return () => {
      stopWaiting();
      leaveMatchQueue(sessionRef.current).catch(() => {});
    };
  }, [stopWaiting]);

  function enterRoom(room) {
    stopWaiting();
    navigate(`/rooms/${room.id}`, { state: { code: room.code, status: room.status, isCreator: false } });
  }

  // Whoever's /match request completes the group gets the room back
  // directly. Everyone already queued has no such response waiting for
  // them, so this page polls /api/rooms/mine/active to find out once
  // someone else's request has matched them in (see the server-side
  // comment on that route for why it exists).
  function startQueuePolling() {
    pollRef.current = setInterval(async () => {
      try {
        const { room } = await getActiveRoom(session);
        if (room) enterRoom(room);
      } catch (e) {
        setError(e.message);
      }
    }, QUEUE_POLL_INTERVAL_MS);

    giveUpRef.current = setTimeout(async () => {
      stopWaiting();
      setQueued(false);
      setGaveUp(true);
      await leaveMatchQueue(session).catch(() => {});
    }, MAX_QUEUE_WAIT_MS);
  }

  async function handleMatch() {
    setBusy(true);
    setError(null);
    setGaveUp(false);
    try {
      const result = await requestMatch(session, { durationSeconds });
      if (result.status === 'queued') {
        setQueued(true);
        startQueuePolling();
      } else {
        enterRoom(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const searching = busy || queued;

  return (
    <AppShell title="Random match" subtitle="Get grouped with other students looking to practice right now.">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-xl border border-border-base bg-surface-container-lowest p-12 shadow-sm lg:col-span-3">
          <div className="relative mb-12 flex h-28 w-28 items-center justify-center">
            {searching && (
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: '2.5s' }} />
            )}
            <span
              className={`flex h-28 w-28 items-center justify-center rounded-full ${
                gaveUp ? 'bg-surface-container-high' : queued ? 'bg-success' : 'bg-primary'
              }`}
            >
              <span
                className={`material-symbols-outlined text-5xl ${gaveUp ? 'text-on-surface-variant' : 'text-white'}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {gaveUp ? 'schedule' : queued ? 'groups' : 'person_search'}
              </span>
            </span>
          </div>

          {gaveUp ? (
            <div className="z-10 space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-headline-lg font-bold text-on-surface">Nobody else is free right now</h3>
                <p className="mx-auto max-w-md text-body-md text-text-secondary">
                  A discussion needs a few students to get going, and there aren&apos;t enough online at the moment.
                  You&apos;ve been taken out of the queue.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Link
                  to="/rooms/new"
                  className="rounded-xl bg-primary px-8 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Start a room and share the code
                </Link>
                <button
                  type="button"
                  onClick={handleMatch}
                  className="text-label-md font-semibold text-primary hover:underline"
                >
                  Or try matching again
                </button>
              </div>
            </div>
          ) : (
            <div className="z-10 space-y-2 text-center">
              <h3 className={`text-headline-lg font-bold ${queued ? 'text-success' : 'text-on-surface'}`}>
                {queued ? "You're queued" : 'Ready to find a group?'}
              </h3>
              <p className="mx-auto max-w-md text-body-md text-text-secondary">
                {queued
                  ? "We'll take you straight into the room the moment enough other students are matched in. If nobody turns up within a minute or two, we'll tell you rather than leave you waiting."
                  : 'Pick a session length and we’ll match you with other students as soon as they’re ready too.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
            <DurationPicker valueSeconds={durationSeconds} onChange={setDurationSeconds} disabled={busy || queued} />
          </div>

          <div className="rounded-xl border border-border-base bg-surface-container-low p-6">
            <h3 className="mb-6 flex items-center gap-2 text-label-md font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary text-lg">fact_check</span>
              Status
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined text-xl text-success"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  Duration set — {Math.round(durationSeconds / 60)} min
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`material-symbols-outlined text-xl ${
                    searching ? 'text-success' : 'text-outline'
                  }`}
                  style={{ fontVariationSettings: searching ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {searching ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-body-sm text-on-surface-variant">Match request sent</span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`material-symbols-outlined text-xl ${queued ? 'text-primary animate-pulse' : 'text-outline'}`}
                >
                  {queued ? 'pending' : 'radio_button_unchecked'}
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  {queued ? 'Waiting for enough students to join…' : 'Waiting for group'}
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleMatch}
            disabled={busy || queued}
            className="w-full rounded-xl bg-primary py-6 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Looking for a match…' : queued ? "You're queued" : 'Find me a group'}
          </button>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
