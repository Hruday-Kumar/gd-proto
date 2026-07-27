import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoomStatus, startRoom, getMyFeedback, getRoomTranscript } from '../rooms/roomsApi.js';
import { AppShell } from '../components/AppShell.jsx';
import { TranscriptList } from '../components/TranscriptList.jsx';
import { FeedbackRating } from '../components/FeedbackRating.jsx';

// livekit-client is by far the largest dependency in the app and is only
// ever needed once a room actually goes live -- loading it lazily keeps it
// out of the bundle every other screen pays for.
const LiveRoomAudio = lazy(() =>
  import('../rooms/LiveRoomAudio.jsx').then((m) => ({ default: m.LiveRoomAudio }))
);

const POLL_INTERVAL_MS = 3000;
// Feedback generation is a single Gemini call dispatched server-side; if
// it hasn't landed in ~2 minutes it has failed rather than "still working",
// so stop hammering the API and say so.
const MAX_FEEDBACK_POLLS = 40;

const STATUS_META = {
  waiting: { label: 'Waiting to start', icon: 'hourglass_empty', style: 'bg-surface-container-high text-on-surface-variant' },
  live: { label: 'Live', icon: 'sensors', style: 'bg-primary-container text-on-primary-container' },
  ended: { label: 'Ended', icon: 'check_circle', style: 'bg-success-container text-success' },
};

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// The server is the single source of truth for when a session ends
// (PHASE1_PLAN.md §5 W4 -- server-authoritative timer). This page never
// decides "ended" on its own; it just keeps asking the server and shows
// whatever it says.
export function LobbyPage() {
  const { id } = useParams();
  const location = useLocation();
  const { session } = useAuth();
  // Navigation state is only a first paint hint -- every one of these is
  // re-sourced from the server's /status response below, so a browser
  // refresh (which wipes router state entirely) still shows the topic,
  // the room code, and the creator's start button.
  const [isCreator, setIsCreator] = useState(location.state?.isCreator ?? false);
  const [code, setCode] = useState(location.state?.code ?? null);
  const [topicText, setTopicText] = useState(location.state?.topicText ?? null);
  const [status, setStatus] = useState(location.state?.status ?? 'waiting');
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackRatingReason, setFeedbackRatingReason] = useState('');
  const [feedbackFailed, setFeedbackFailed] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptError, setTranscriptError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => {
    if (!session) return;
    getRoomStatus(session, id)
      .then((r) => {
        setStatus(r.status);
        if (r.endsAt) setEndsAt(r.endsAt);
        if (r.code) setCode(r.code);
        if (r.topicText) setTopicText(r.topicText);
        setIsCreator(r.isCreator);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [session, id]);

  // An ended room never changes again, so polling past that point is pure
  // waste on both the client and the free-tier backend.
  useEffect(() => {
    refresh();
    if (status === 'ended') return undefined;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, status]);

  // The server is the sole authority on when time's up (sessionStateMachine.js
  // / the /status endpoint) -- this just ticks the display once a second
  // between polls so the countdown doesn't visibly stall for up to
  // POLL_INTERVAL_MS. It never itself decides the session has ended.
  useEffect(() => {
    if (status !== 'live' || !endsAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [status, endsAt]);

  // Transcript is a one-shot fetch once the session has ended -- unlike
  // feedback it never changes, and unlike feedback it doesn't need
  // generation dispatched first (transcript_lines are already persisted
  // live by the agent worker as the discussion happens).
  useEffect(() => {
    if (status !== 'ended' || transcript || !session) return;
    getRoomTranscript(session, id)
      .then((r) => setTranscript(r.lines))
      .catch(() => {
        // Transcript is a nice-to-have alongside feedback -- don't block the
        // ended view on it, but don't leave a permanent "Loading…" either.
        setTranscriptError(true);
      });
  }, [status, transcript, session, id]);

  // Feedback generation (W6) is dispatched server-side the moment a poll
  // observes the room as ended -- it's not ready yet on that same poll, so
  // this keeps asking until it is rather than treating "not ready" as an
  // error.
  useEffect(() => {
    if (status !== 'ended' || feedback || !session) return;
    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    function poll() {
      if (attempts++ >= MAX_FEEDBACK_POLLS) {
        clearInterval(interval);
        if (!cancelled) setFeedbackFailed(true);
        return;
      }
      getMyFeedback(session, id)
        .then((r) => {
          if (cancelled || !r.feedback) return;
          setFeedback(r.feedback);
          if (r.rating !== undefined) setFeedbackRating(r.rating);
          if (r.ratingReason) setFeedbackRatingReason(r.ratingReason);
        })
        .catch(() => {});
    }

    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, feedback, session, id]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await startRoom(session, id);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  function handleCopyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const meta = STATUS_META[status] ?? STATUS_META.waiting;

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">{topicText ?? 'Group discussion room'}</h2>
          {code && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="mt-2 flex items-center gap-2 rounded-lg border border-border-base bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-base text-primary">tag</span>
              {code}
              <span className="material-symbols-outlined text-base text-outline">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          )}
        </div>
        <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-6 py-1.5 text-label-md font-semibold ${meta.style}`}>
          <span className="material-symbols-outlined text-base">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
          {error}
        </p>
      )}

      {isCreator && status === 'waiting' && (
        <div className="mb-6 rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
          <p className="mb-3 text-body-sm text-text-secondary">
            Share the room code above with classmates, then start the session once everyone's in.
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="rounded-lg bg-primary px-8 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? 'Starting…' : 'Start session'}
          </button>
        </div>
      )}

      {status === 'waiting' && !isCreator && (
        <div className="flex items-center gap-3 rounded-xl border border-border-base bg-surface-container-lowest p-6 text-body-md text-text-secondary shadow-sm">
          <span className="material-symbols-outlined animate-pulse text-primary">hourglass_empty</span>
          Waiting for the room creator to start the session.
        </div>
      )}

      {status === 'live' && (
        <div className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
          {endsAt && (
            <div className="mb-4 flex items-center gap-2 text-label-md font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-base">timer</span>
              {formatCountdown(Math.max(0, Math.round((endsAt - now) / 1000)))} remaining
            </div>
          )}
          <Suspense
            fallback={
              <p className="flex items-center gap-2 text-body-sm text-text-secondary">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Connecting to the audio room…
              </p>
            }
          >
            <LiveRoomAudio roomId={id} />
          </Suspense>
        </div>
      )}

      {status === 'ended' && (
        <div className="rounded-xl border border-border-base bg-surface-container-lowest p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-success" style={{ fontVariationSettings: "'FILL' 1" }}>
              task_alt
            </span>
            <h3 className="text-headline-sm font-semibold text-on-surface">This session has ended</h3>
          </div>
          <div className="mt-6 rounded-lg bg-surface-container-low p-6">
            <p className="text-label-sm font-semibold text-on-surface-variant">Your feedback</p>
            <p className="mt-1 text-body-md text-on-surface">
              {feedback ??
                (feedbackFailed
                  ? "Your feedback is taking longer than expected. It'll appear under History once it's ready."
                  : 'Generating your feedback…')}
            </p>
            {feedback && (
              <FeedbackRating
                session={session}
                roomId={id}
                initialRating={feedbackRating}
                initialReason={feedbackRatingReason}
              />
            )}
          </div>
          <div className="mt-4 rounded-lg bg-surface-container-low p-6">
            <p className="mb-2 text-label-sm font-semibold text-on-surface-variant">Transcript</p>
            {transcript && <TranscriptList lines={transcript} />}
            {!transcript && !transcriptError && <p className="text-body-sm text-outline">Loading…</p>}
            {!transcript && transcriptError && (
              <p className="text-body-sm text-outline">
                We couldn&apos;t load the transcript for this session. You can try again from History.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
