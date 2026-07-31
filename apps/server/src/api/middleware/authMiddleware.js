import { createRemoteJWKSet } from 'jose';
import { createTokenVerifier } from '../../domain/verifyToken.js';

// Every protected route sits behind this — see PHASE1_PLAN.md W2. Building
// the JWKS resolver here (once, at middleware-creation time) rather than
// per-request; jose fetches lazily and caches, so this doesn't hit the
// network until the first real token comes through.
export function createAuthMiddleware({ supabaseUrl } = {}) {
  const url = supabaseUrl ?? process.env.SUPABASE_URL;
  if (!url) throw new Error('Missing SUPABASE_URL');

  const issuer = `${url}/auth/v1`;
  const getKey = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const verifyToken = createTokenVerifier({ getKey, issuer });

  return async function requireAuth(req, res, next) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const result = await verifyToken(token);
    if (!result.valid) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    req.userId = result.userId;
    next();
  };
}
