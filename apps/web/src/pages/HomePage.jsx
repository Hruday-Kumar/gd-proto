import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useConsentStatus } from '../consent/useConsentStatus.js';
import { AppShell } from '../components/AppShell.jsx';

// Random matching is deliberately not one of these. It only forms a room
// when enough students happen to be online at the same moment, which is
// rare at pilot scale -- leading with it makes a dead end the first thing
// a student tries. It stays available as a secondary link below.
const ACTIONS = [
  {
    to: '/rooms/new',
    icon: 'add_circle',
    title: 'Start a room',
    body: 'Get an AI-generated topic or bring your own, then share a code with classmates.',
    cta: 'Create room',
  },
  {
    to: '/rooms/join',
    icon: 'meeting_room',
    title: 'Join by code',
    body: 'Have a room code from a classmate? Jump straight into their session.',
    cta: 'Enter code',
  },
];

export function HomePage() {
  const { user, session } = useAuth();
  const { canEnableMic, loading: consentLoading, error: consentError } = useConsentStatus(session);

  const emailName = user?.email?.split('@')[0] ?? 'there';

  return (
    <AppShell>
      <section className="mb-12 overflow-hidden rounded-xl bg-primary p-12 text-on-primary">
        <h2 className="text-headline-xl font-bold truncate">Welcome back, {emailName}</h2>
        <p className="mt-2 max-w-xl text-body-lg opacity-90">
          Jump into a live Group Discussion room with real classmates and get individual, per-speaker feedback when
          you're done.
        </p>
      </section>

      {consentError && (
        <div
          role="alert"
          className="mb-8 flex items-center gap-3 rounded-xl bg-danger-container px-6 py-3 text-body-sm text-danger"
        >
          <span className="material-symbols-outlined">cloud_off</span>
          We can&apos;t reach PlaceMe&apos;s servers right now. Rooms won&apos;t start until the connection is back —
          please try again in a moment.
        </div>
      )}

      {!consentLoading && !consentError && !canEnableMic && (
        <div className="mb-8 flex items-center justify-between gap-6 rounded-xl border border-tertiary/30 bg-tertiary-container p-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-tertiary-container">mic_off</span>
            <p className="text-body-sm text-on-tertiary-container">
              You haven't granted mic consent yet — you'll need to before you can join a live room.
            </p>
          </div>
          <Link
            to="/consent"
            className="whitespace-nowrap rounded-lg bg-on-tertiary-container px-6 py-2 text-label-sm font-semibold text-tertiary-container"
          >
            Review consent
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex flex-col rounded-xl border border-border-base bg-surface-container-lowest p-6 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
              <span className="material-symbols-outlined text-on-primary-container">{action.icon}</span>
            </div>
            <h3 className="text-headline-sm font-semibold text-on-surface">{action.title}</h3>
            <p className="mt-1 flex-1 text-body-sm text-text-secondary">{action.body}</p>
            <span className="mt-6 flex items-center gap-1 text-label-md font-semibold text-primary">
              {action.cta}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-base bg-surface-container-low p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">shuffle</span>
          <div>
            <h3 className="text-label-md font-semibold text-on-surface">No group yet?</h3>
            <p className="text-body-sm text-text-secondary">
              Try a random match — works best when a few classmates are online together.
            </p>
          </div>
        </div>
        <Link to="/rooms/match" className="text-label-md font-semibold text-primary hover:underline">
          Find a group
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">history</span>
          <div>
            <h3 className="text-label-md font-semibold text-on-surface">Your session history</h3>
            <p className="text-body-sm text-text-secondary">Review topics, timing, and feedback from past rooms.</p>
          </div>
        </div>
        <Link to="/history" className="text-label-md font-semibold text-primary hover:underline">
          View history
        </Link>
      </div>
    </AppShell>
  );
}
