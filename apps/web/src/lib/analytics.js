// Tier 2 instrumentation (docs/business/ceo-dashboard.md §4): pre-signup/
// pre-consent funnel behaviour the database genuinely can't see (Postgres
// only has rows for students who made it all the way to an account).
//
// No-op until VITE_POSTHOG_KEY is set in apps/web/.env -- every call below
// is safe to leave in place with no PostHog account at all. posthog-js is
// loaded lazily (dynamic import) so pages that never call track() don't
// pay for it, and nothing here runs until a key exists.
//
// Before actually setting VITE_POSTHOG_KEY in a real deployment: the
// existing consent flow (ConsentPage.jsx) discloses mic capture and Gemini
// processing, not general behavioural analytics -- review whether that
// copy needs a line about it first. Not decided here; flagging so it isn't
// silently skipped.
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogPromise = null;

function getPosthog() {
  if (!POSTHOG_KEY) return null;
  if (!posthogPromise) {
    posthogPromise = import('posthog-js').then(({ default: posthog }) => {
      // Autocapture/session recording off by default -- the events below
      // are deliberately named and scoped (docs/business/ceo-dashboard.md §4's
      // Tier 2 list), not "capture everything and sort it out later".
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        autocapture: false,
        disable_session_recording: true,
      });
      return posthog;
    });
  }
  return posthogPromise;
}

export function track(event, props) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.then((ph) => ph.capture(event, props)).catch(() => {});
}

export function identify(userId) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.then((ph) => ph.identify(userId)).catch(() => {});
}
