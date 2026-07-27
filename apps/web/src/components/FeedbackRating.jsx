import { useState } from 'react';
import { rateFeedback } from '../rooms/roomsApi.js';

// S1 (pilot-readiness audit): a thumbs up/down + one-line "why" is the
// cheapest real signal on whether generated feedback is actually useful --
// until now the only evidence was one founder's opinion. Saves immediately
// on a thumb click (no separate submit step to abandon), then offers an
// optional one-line reason that saves on blur/Enter.
export function FeedbackRating({ session, roomId, initialRating = null, initialReason = '' }) {
  const [rating, setRating] = useState(initialRating);
  const [reason, setReason] = useState(initialReason);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(nextRating, nextReason) {
    setSaving(true);
    setError(null);
    try {
      await rateFeedback(session, roomId, { rating: nextRating, reason: nextReason || undefined });
      setRating(nextRating);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleThumb(value) {
    setShowReasonInput(true);
    submit(value, reason);
  }

  function handleReasonCommit() {
    const trimmed = reason.trim();
    if (trimmed && trimmed !== initialReason) submit(rating, trimmed);
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border-base pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-label-sm font-semibold text-on-surface-variant">Was this feedback useful?</p>
        <button
          type="button"
          onClick={() => handleThumb(true)}
          disabled={saving}
          aria-pressed={rating === true}
          aria-label="Yes, this feedback was useful"
          className={`rounded-full p-2 transition-colors ${
            rating === true ? 'bg-success-container text-success' : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: `'FILL' ${rating === true ? 1 : 0}` }}>
            thumb_up
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleThumb(false)}
          disabled={saving}
          aria-pressed={rating === false}
          aria-label="No, this feedback was not useful"
          className={`rounded-full p-2 transition-colors ${
            rating === false ? 'bg-danger-container text-danger' : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: `'FILL' ${rating === false ? 1 : 0}` }}>
            thumb_down
          </span>
        </button>
        {rating !== null && !showReasonInput && <span className="text-body-sm text-success">Thanks for the feedback</span>}
      </div>

      {rating !== null && showReasonInput && (
        <input
          type="text"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={handleReasonCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="One line on why (optional)"
          className="w-full rounded-lg border border-border-base bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface"
        />
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          Couldn&apos;t save your rating: {error}
        </p>
      )}
    </div>
  );
}
