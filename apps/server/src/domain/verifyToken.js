// Verifies a Supabase Auth access token asymmetrically against the
// project's JWKS — the approach Supabase's own docs recommend over the
// legacy shared-secret (HS256) verification, which they explicitly warn
// against for new projects. `getKey` is injected (jose's
// createRemoteJWKSet in production, createLocalJWKSet in tests) so this
// function never needs a live network call to be tested.
import { jwtVerify } from 'jose';

export function createTokenVerifier({ getKey, issuer }) {
  return async function verifyToken(token) {
    if (!token) return { valid: false, reason: 'missing' };

    try {
      const { payload } = await jwtVerify(token, getKey, issuer ? { issuer } : undefined);
      if (!payload.sub) return { valid: false, reason: 'no-subject' };
      return { valid: true, userId: payload.sub, payload };
    } catch (e) {
      return { valid: false, reason: e.code ?? e.message };
    }
  };
}
