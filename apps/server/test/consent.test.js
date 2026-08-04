// Core logic test (guardrail #3 / #9): canEnableMic() is the single gate a
// LiveKit token mint must call before ever letting a client's mic into a
// room. Pure function, no DB — the caller is responsible for fetching the
// student's latest consent row and passing it in.
import { describe, it, expect } from 'vitest';
import { canEnableMic, CURRENT_CONSENT_VERSION } from '../src/domain/consent.js';

describe('canEnableMic', () => {
  it('returns false when there is no consent record', () => {
    expect(canEnableMic(null)).toBe(false);
    expect(canEnableMic(undefined)).toBe(false);
  });

  it('returns false when the stored consent_version is older than current', () => {
    const stale = { consent_version: CURRENT_CONSENT_VERSION - 1, granted_at: new Date().toISOString() };
    expect(canEnableMic(stale)).toBe(false);
  });

  it('returns true when the stored consent_version matches current', () => {
    const current = { consent_version: CURRENT_CONSENT_VERSION, granted_at: new Date().toISOString() };
    expect(canEnableMic(current)).toBe(true);
  });

  // M8 (audit 2026-07-28): PostHog analytics (apps/web/src/lib/analytics.js)
  // was added without bumping this version, so a student who consented
  // before that disclosure existed would be silently carried forward as
  // "current" the moment VITE_POSTHOG_KEY is set live. Pinning the version
  // number itself (not just comparing against the constant, like the tests
  // above) is deliberate -- it's the only way to catch a future PR
  // reintroducing this exact gap by adding a new data use without bumping.
  it('requires re-consent from a student who only agreed to the pre-analytics-disclosure version', () => {
    expect(canEnableMic({ consent_version: 1 })).toBe(false);
    expect(CURRENT_CONSENT_VERSION).toBeGreaterThanOrEqual(2);
  });

  // Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): a `>=` comparison
  // treats any consent_version above the current constant as valid --
  // meaning a corrupted row, or a future rollback of CURRENT_CONSENT_VERSION
  // to fix a bad bump, would silently keep letting a student's mic on
  // without them ever having agreed to the version now in force. Consent
  // must match the exact version currently disclosed, not merely be "at
  // least" it.
  it('requires an exact version match, not merely a version at or above current', () => {
    const ahead = { consent_version: CURRENT_CONSENT_VERSION + 1, granted_at: new Date().toISOString() };
    expect(canEnableMic(ahead)).toBe(false);
  });
});
