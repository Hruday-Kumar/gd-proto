import { Router } from 'express';
import { CURRENT_CONSENT_VERSION, canEnableMic } from '../domain/consent.js';

// W3 (guardrail #3): lets a student record consent and check their current
// status. Recording is append-only (see the migration's RLS policy) — a new
// consent version means a new row, never an edit to an old one.
export function createConsentRouter(requireAuth, { getLatestConsent, recordConsent }) {
  const router = Router();

  router.get('/api/consent/status', requireAuth, async (req, res) => {
    const latest = await getLatestConsent(req.userId);
    res.status(200).json({
      currentVersion: CURRENT_CONSENT_VERSION,
      canEnableMic: canEnableMic(latest),
    });
  });

  router.post('/api/consent', requireAuth, async (req, res) => {
    const recorded = await recordConsent(req.userId, CURRENT_CONSENT_VERSION);
    res.status(201).json({
      consentVersion: recorded.consent_version,
      grantedAt: recorded.granted_at,
    });
  });

  return router;
}
