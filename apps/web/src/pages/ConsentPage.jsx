import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useConsentStatus } from '../consent/useConsentStatus.js';

// The hard gate from guardrail #3: this copy must be shown, and agreed to,
// before any mic is ever enabled. Every disclosure below is required by
// PHASE1_PLAN.md's W3 section — don't trim any of them without updating
// that plan and bumping CURRENT_CONSENT_VERSION.
export function ConsentPage() {
  const { session } = useAuth();
  const { canEnableMic, loading, error, grantConsent } = useConsentStatus(session);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function handleAgree() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await grantConsent();
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (canEnableMic) {
    return (
      <section>
        <h1>Consent recorded</h1>
        <p>You've already agreed to the current consent terms. You're clear to join a mic-enabled room.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Before you join a Group Discussion</h1>
      <p>Please read and agree to the following before your microphone is ever turned on:</p>
      <ul>
        <li>
          <strong>Microphone capture.</strong> When you join a GD room, your microphone audio is
          captured live so it can be transcribed and so the other participants can hear you.
        </li>
        <li>
          <strong>Raw audio is never stored.</strong> Your audio is streamed directly to our
          transcription service and is never saved to a disk or database — it exists only for the
          moment it takes to convert your speech to text.
        </li>
        <li>
          <strong>Your transcript and feedback are kept until you delete your account.</strong>{' '}
          Only you can see your own session history.
        </li>
        <li>
          <strong>Feedback is generated using Google's Gemini API, on its free tier.</strong>{' '}
          Under Gemini's free-tier terms, the transcript sent for feedback may be used by Google to
          improve their products, and may be reviewed by a human at Google. If you're not
          comfortable with this, please don't proceed until a paid-tier option is available.
        </li>
      </ul>
      {error && <p role="alert">Couldn't load your consent status: {error}</p>}
      {submitError && <p role="alert">Couldn't record your consent: {submitError}</p>}
      <button type="button" onClick={handleAgree} disabled={submitting}>
        {submitting ? 'Recording…' : 'I have read this and agree'}
      </button>
    </section>
  );
}
