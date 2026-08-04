// Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): livekit-server-sdk's
// AccessToken defaults to a 6-hour ttl when none is given. A GD Arena room
// is bounded to at most 25 minutes (rooms.duration_seconds, migration
// 0010) -- a 6-hour join token massively outlives the room it was minted
// for, so a leaked token (logs, browser history, a shared link) stays a
// usable room-join credential for hours after the session that issued it
// ever ended. mintToken must set an explicit, short ttl instead of
// inheriting the SDK default.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodeJwt } from 'jose';

const ORIGINAL_ENV = { ...process.env };

describe('mintToken', () => {
  let mintToken;

  beforeAll(async () => {
    process.env.LIVEKIT_API_KEY = 'test-key';
    process.env.LIVEKIT_API_SECRET = 'test-secret-at-least-32-bytes-long!!';
    ({ mintToken } = await import('../src/livekit/token.js'));
  });

  afterAll(() => {
    process.env.LIVEKIT_API_KEY = ORIGINAL_ENV.LIVEKIT_API_KEY;
    process.env.LIVEKIT_API_SECRET = ORIGINAL_ENV.LIVEKIT_API_SECRET;
  });

  it('mints a token with a ttl of 30 minutes, not the SDK default of 6 hours', async () => {
    const before = Math.floor(Date.now() / 1000);
    const jwt = await mintToken('user-123', 'room-abc');
    const claims = decodeJwt(jwt);
    const ttlSeconds = claims.exp - before;
    // AccessToken doesn't set `iat`, so measure from just-before-mint
    // instead -- a couple of seconds of test-execution slack either side
    // of 1800 is expected, six hours of slack (21600) is not.
    expect(ttlSeconds).toBeGreaterThan(30 * 60 - 5);
    expect(ttlSeconds).toBeLessThanOrEqual(30 * 60);
  });
});
