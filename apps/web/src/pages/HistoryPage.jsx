import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { getMyHistory, getRoomTranscript } from '../rooms/roomsApi.js';
import { AppShell } from '../components/AppShell.jsx';
import { TranscriptList } from '../components/TranscriptList.jsx';

const STATUS_STYLES = {
  waiting: 'bg-surface-container-high text-on-surface-variant',
  live: 'bg-primary-container text-on-primary-container',
  ended: 'bg-success-container text-success',
};

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

// Real aggregates from the student's own fetched sessions -- no scoring or
// competency data exists in this MVP, so unlike a generic dashboard mockup
// this only surfaces numbers we actually have (count + summed duration).
function summarize(sessions) {
  const completed = sessions.filter((s) => s.status === 'ended').length;
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  const totalPractice = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { completed, totalPractice };
}

// Lazily fetches the transcript only once a student actually asks to see
// it -- fetching every past session's full transcript up front would be
// wasted work for a list a student may never expand.
function SessionTranscript({ session, roomId }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(null);
  const [error, setError] = useState(null);

  function toggle() {
    if (!open && lines === null) {
      getRoomTranscript(session, roomId)
        .then((r) => setLines(r.lines))
        .catch((e) => setError(e.message));
    }
    setOpen((o) => !o);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-label-sm font-semibold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
        {open ? 'Hide transcript' : 'View transcript'}
      </button>
      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-surface-container-low p-3">
          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}
          {!error && lines === null && <p className="text-body-sm text-outline">Loading…</p>}
          {lines && <TranscriptList lines={lines} />}
        </div>
      )}
    </div>
  );
}

// W7 (Session history, PHASE1_PLAN.md §5): a student's own past sessions --
// topic, date, and their own feedback (never another participant's, per
// the RLS isolation proven in test/historyRlsIsolation.test.js).
export function HistoryPage() {
  const { session } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session) return;
    getMyHistory(session)
      .then((r) => setSessions(r.sessions))
      .catch((e) => setError(e.message));
  }, [session]);

  const stats = sessions && sessions.length > 0 ? summarize(sessions) : null;

  return (
    <AppShell title="Your session history" subtitle="Every GD room you've joined, with your own feedback.">
      {error && (
        <p role="alert" className="rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
          {error}
        </p>
      )}

      {!sessions && !error && <p className="text-body-md text-text-secondary">Loading…</p>}

      {sessions && sessions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-base bg-surface-container-lowest p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-outline">forum</span>
          <p className="mt-3 text-body-md text-text-secondary">
            No sessions yet — join or start a GD to see it here.
          </p>
        </div>
      )}

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
            <p className="text-label-sm font-semibold uppercase tracking-wide text-text-secondary">
              Sessions completed
            </p>
            <p className="mt-1 text-headline-lg font-bold text-on-surface">{stats.completed}</p>
          </div>
          <div className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
            <p className="text-label-sm font-semibold uppercase tracking-wide text-text-secondary">
              Total practice time
            </p>
            <p className="mt-1 text-headline-lg font-bold text-on-surface">{stats.totalPractice}</p>
          </div>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="space-y-6">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-headline-sm font-semibold text-on-surface">
                    {s.topicText ?? 'Untitled topic'}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-text-secondary">
                    {s.startedAt && <span>{new Date(s.startedAt).toLocaleString()}</span>}
                    {formatDuration(s.durationSeconds) && <span>· {formatDuration(s.durationSeconds)}</span>}
                    <span>· code {s.code}</span>
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-label-sm font-semibold capitalize ${
                    STATUS_STYLES[s.status] ?? 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {s.status}
                </span>
              </div>

              <div className="mt-6 rounded-lg bg-surface-container-low p-3">
                <p className="text-label-sm font-semibold text-on-surface-variant">Your feedback</p>
                <p className="mt-1 text-body-sm text-on-surface">
                  {s.feedback ?? (s.status === 'ended' ? 'Generating your feedback…' : 'No feedback yet.')}
                </p>
              </div>
              {s.status === 'ended' && <SessionTranscript session={session} roomId={s.id} />}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
