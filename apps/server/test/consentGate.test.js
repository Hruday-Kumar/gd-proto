// Core logic test (guardrail #3): this middleware is what "every LiveKit
// token mint must call canEnableMic()" means in practice — a composable
// gate any future route (the real mint route lands in W5) can sit behind.
// Proven here against a stub route standing in for that future mint route.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createConsentGate } from '../src/api/middleware/consentGate.js';
import { CURRENT_CONSENT_VERSION } from '../src/domain/consent.js';

function appWithGate(getLatestConsent) {
  const app = express();
  app.use((req, _res, next) => {
    req.userId = 'user-123';
    next();
  });
  app.get('/mint-token', createConsentGate({ getLatestConsent }), (_req, res) => {
    res.status(200).json({ token: 'fake-livekit-token' });
  });
  return app;
}

describe('consent gate (guardrail #3)', () => {
  it('blocks token issuance when there is no consent record', async () => {
    const res = await request(appWithGate(async () => null)).get('/mint-token');
    expect(res.status).toBe(403);
  });

  it('blocks token issuance when the stored consent is stale', async () => {
    const stale = async () => ({ consent_version: CURRENT_CONSENT_VERSION - 1 });
    const res = await request(appWithGate(stale)).get('/mint-token');
    expect(res.status).toBe(403);
  });

  it('allows token issuance with a current consent record', async () => {
    const current = async () => ({ consent_version: CURRENT_CONSENT_VERSION });
    const res = await request(appWithGate(current)).get('/mint-token');
    expect(res.status).toBe(200);
  });
});
