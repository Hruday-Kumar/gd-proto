// Router-level tests for the consent endpoints. requireAuth is stubbed
// (already covered by test/authMiddleware.test.js) so these stay fast and
// offline while proving the route logic: what status/status body comes
// back, and what gets passed to the injected db functions.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createConsentRouter } from '../src/api/routes/consent.js';
import { CURRENT_CONSENT_VERSION } from '../src/domain/consent.js';

function stubAuth(req, _res, next) {
  req.userId = 'user-123';
  next();
}

function buildApp({ getLatestConsent, recordConsent }) {
  const app = express();
  app.use(express.json());
  app.use(createConsentRouter(stubAuth, { getLatestConsent, recordConsent }));
  return app;
}

describe('consent API', () => {
  it('GET /api/consent/status reports canEnableMic: false with no record', async () => {
    const app = buildApp({ getLatestConsent: async () => null, recordConsent: async () => {} });
    const res = await request(app).get('/api/consent/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentVersion: CURRENT_CONSENT_VERSION, canEnableMic: false });
  });

  it('POST /api/consent records a current-version consent for the authenticated user', async () => {
    let recordedArgs;
    const app = buildApp({
      getLatestConsent: async () => null,
      recordConsent: async (userId, version) => {
        recordedArgs = [userId, version];
        return { consent_version: version, granted_at: '2026-07-26T00:00:00.000Z' };
      },
    });
    const res = await request(app).post('/api/consent');
    expect(res.status).toBe(201);
    expect(res.body.consentVersion).toBe(CURRENT_CONSENT_VERSION);
    expect(recordedArgs).toEqual(['user-123', CURRENT_CONSENT_VERSION]);
  });

  it('GET /api/consent/status reports canEnableMic: true after a current consent', async () => {
    const app = buildApp({
      getLatestConsent: async () => ({ consent_version: CURRENT_CONSENT_VERSION }),
      recordConsent: async () => {},
    });
    const res = await request(app).get('/api/consent/status');
    expect(res.body.canEnableMic).toBe(true);
  });
});
