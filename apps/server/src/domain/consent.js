// Consent gate (guardrail #3 — hard gate, W3). Pure: takes the caller's
// latest consent row (or null/undefined if none exists) and decides
// whether that student's mic may be enabled. No DB access here — callers
// fetch the latest consents row for the user and pass it in.
//
// Bump this whenever the disclosure copy changes materially (e.g. a new
// data use is added) so existing students are required to re-consent
// rather than being silently carried forward on stale consent.
//
// v2 (M8, audit 2026-07-28): PostHog analytics (apps/web/src/lib/
// analytics.js) was added in the B2 pilot-readiness pass without this bump
// -- currently inert (posthog-js is dead-code-eliminated while
// VITE_POSTHOG_KEY is unset) but becomes a live DPDP problem the instant
// that key is set, since existing students would never be asked to
// re-consent to a new data use. Bumped now, with the disclosure added to
// ConsentPage.jsx, so the key can be turned on later without this gap
// reopening.
export const CURRENT_CONSENT_VERSION = 2;

export function canEnableMic(latestConsent, currentVersion = CURRENT_CONSENT_VERSION) {
  if (!latestConsent) return false;
  return latestConsent.consent_version === currentVersion;
}
