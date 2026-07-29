import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useConsentStatus } from '../consent/useConsentStatus.js';
import { AppShell } from '../components/AppShell.jsx';
import { LoadingScreen } from '../components/LoadingScreen.jsx';
import { track } from '../lib/analytics.js';

const DISCLOSURES = [
  {
    icon: 'mic',
    title: 'Microphone capture',
    body: 'When you join a GD room, your microphone audio is captured live so it can be transcribed and so the other participants can hear you.',
  },
  {
    icon: 'cloud_off',
    title: 'Raw audio is never stored',
    body: 'Your audio is streamed directly to our transcription service and is never saved to a disk or database — it exists only for the moment it takes to convert your speech to text.',
  },
  {
    icon: 'history',
    title: 'Transcript and feedback retention',
    body: (
      <>
        Your transcript and feedback are kept until you delete your account. Only you can see your own session
        history.
      </>
    ),
  },
  {
    icon: 'smart_toy',
    title: "Feedback via Google's Gemini API (free tier)",
    body: "Under Gemini's free-tier terms, the transcript sent for feedback may be used by Google to improve their products, and may be reviewed by a human at Google. If you're not comfortable with this, please don't proceed until a paid-tier option is available.",
  },
  {
    icon: 'analytics',
    title: 'Usage analytics',
    body: 'We may track basic usage events (like page views and whether signup or consent succeeded) to understand how PlaceMe is used and improve it. This never includes your transcript or feedback content.',
  },
];

// The hard gate from guardrail #3: this copy must be shown, and agreed to,
// before any mic is ever enabled. Every disclosure below is required by
// PHASE1_PLAN.md's W3 section — don't trim any of them without updating
// that plan and bumping CURRENT_CONSENT_VERSION.
export function ConsentPage() {
  const { session } = useAuth();
  const { canEnableMic, loading, error, grantConsent, refresh } = useConsentStatus(session);
  const [hasRead, setHasRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Only the "still needs to agree" view is the actual funnel step (metric
  // 2's consent drop-off, ceo-dashboard.md §4) -- a student who's already
  // agreed and revisits this page isn't part of that funnel.
  useEffect(() => {
    if (!loading && !error && !canEnableMic) track('consent_viewed');
  }, [loading, error, canEnableMic]);

  async function handleAgree() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await grantConsent();
      track('consent_granted');
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen label="Checking your consent status…" />;

  // Without this the page rendered the full agree flow on top of a failed
  // status load, so a student could tick the box, press agree, and hit a
  // second failure with no way forward. Offer the retry instead.
  if (error) {
    return (
      <AppShell title="Mic consent">
        <div className="rounded-xl border border-border-base bg-surface-container-lowest p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-danger">error</span>
            <div>
              <h3 className="text-headline-sm font-semibold text-on-surface">
                We couldn&apos;t load your consent status
              </h3>
              <p role="alert" className="mt-1 text-body-md text-text-secondary">
                {error}. You can&apos;t join a mic-enabled room until this loads, so please try again.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-primary px-8 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90"
            >
              Try again
            </button>
            <Link to="/" className="text-label-md font-semibold text-primary hover:underline">
              Back to home
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (canEnableMic) {
    return (
      <AppShell title="Mic consent">
        <div className="flex items-start gap-6 rounded-xl border border-border-base bg-surface-container-lowest p-8 shadow-sm">
          <span
            className="material-symbols-outlined text-3xl text-success"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <div>
            <h3 className="text-headline-sm font-semibold text-on-surface">Consent recorded</h3>
            <p className="mt-1 text-body-md text-text-secondary">
              You've already agreed to the current consent terms. You're clear to join a mic-enabled room.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Before you join a Group Discussion"
      subtitle="Please read and agree to the following before your microphone is ever turned on."
    >
      <div className="overflow-hidden rounded-xl border border-border-base bg-surface-container-lowest shadow-sm">
        <div className="space-y-6 p-8">
          {DISCLOSURES.map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border-base p-6">
              <span className="material-symbols-outlined mt-0.5 text-primary">{item.icon}</span>
              <div>
                <h3 className="text-label-md font-semibold text-on-surface">{item.title}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 border-t border-border-base bg-surface-container-low p-8 md:flex-row md:items-center md:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-label-md text-on-surface-variant">
            <input
              type="checkbox"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="h-5 w-5 rounded border-outline text-primary focus:ring-primary"
            />
            I have read all of the above
          </label>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg border border-border-base px-8 py-3 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              Decline
            </Link>
            <button
              type="button"
              onClick={handleAgree}
              disabled={!hasRead || submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-12 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Recording…
                </>
              ) : (
                'I have read this and agree'
              )}
            </button>
          </div>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="mt-6 rounded-lg bg-danger-container px-6 py-2 text-body-sm text-danger">
          Couldn't record your consent: {submitError}
        </p>
      )}
    </AppShell>
  );
}
