import { canEnableMic } from '../../domain/consent.js';

// The composable form of guardrail #3: mount this in front of any route
// that lets a client into a mic-enabled room. W5's real LiveKit token mint
// route sits behind this once it exists; until then it's proven against a
// stub route (see test/consentGate.test.js).
export function createConsentGate({ getLatestConsent }) {
  return async function requireConsent(req, res, next) {
    const latest = await getLatestConsent(req.userId);
    if (!canEnableMic(latest)) {
      return res.status(403).json({ error: 'consent_required' });
    }
    next();
  };
}
