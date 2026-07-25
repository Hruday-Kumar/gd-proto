// Consent gate (guardrail #3 — hard gate, W3). Pure: takes the caller's
// latest consent row (or null/undefined if none exists) and decides
// whether that student's mic may be enabled. No DB access here — callers
// fetch the latest consents row for the user and pass it in.
//
// Bump this whenever the disclosure copy changes materially (e.g. a new
// data use is added) so existing students are required to re-consent
// rather than being silently carried forward on stale consent.
export const CURRENT_CONSENT_VERSION = 1;

export function canEnableMic(latestConsent, currentVersion = CURRENT_CONSENT_VERSION) {
  if (!latestConsent) return false;
  return latestConsent.consent_version >= currentVersion;
}
