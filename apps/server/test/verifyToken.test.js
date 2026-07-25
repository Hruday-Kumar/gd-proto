// Core logic test (guardrail #9 / TEAM.md #4: this middleware gates every
// other feature's "own data only" guarantee, so it's tested first, offline,
// against a locally generated keypair — no network call to Supabase).
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { createTokenVerifier } from '../src/domain/verifyToken.js';

const ISSUER = 'https://test-project.supabase.co/auth/v1';
const ALG = 'RS256';

let verify;
let signWith;

async function signToken(privateKey, kid, overrides = {}) {
  const claims = {
    sub: 'user-123',
    role: 'authenticated',
    ...overrides,
  };
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: ALG, kid })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(overrides.exp ?? '1h');
  return jwt.sign(privateKey);
}

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair(ALG);
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key-1';
  jwk.alg = ALG;
  jwk.use = 'sig';

  const { publicKey: otherPublicKey, privateKey: otherPrivateKey } = await generateKeyPair(ALG);
  void otherPublicKey;

  const getKey = createLocalJWKSet({ keys: [jwk] });
  verify = createTokenVerifier({ getKey, issuer: ISSUER });

  signWith = {
    valid: (overrides) => signToken(privateKey, 'test-key-1', overrides),
    wrongKey: (overrides) => signToken(otherPrivateKey, 'test-key-1', overrides),
  };
});

describe('createTokenVerifier', () => {
  it('rejects a missing token', async () => {
    const result = await verify(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects a malformed token', async () => {
    const result = await verify('not.a.jwt');
    expect(result.valid).toBe(false);
  });

  it('rejects an expired token', async () => {
    const token = await signWith.valid({ exp: Math.floor(Date.now() / 1000) - 60 });
    const result = await verify(token);
    expect(result.valid).toBe(false);
  });

  it('rejects a token signed with the wrong key', async () => {
    const token = await signWith.wrongKey();
    const result = await verify(token);
    expect(result.valid).toBe(false);
  });

  it('accepts a valid token and attaches the user id', async () => {
    const token = await signWith.valid();
    const result = await verify(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user-123');
  });
});
