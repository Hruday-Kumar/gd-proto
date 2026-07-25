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
});
