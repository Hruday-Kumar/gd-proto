// Session length used to be a raw seconds number input ("600"), which asked
// a student to do mental arithmetic. This asks for minutes directly instead
// (the unit people actually think in) and converts to seconds for the API.
// 2026-07-28, per direct user request: no more fixed preset list -- a
// student just types how long they want to talk, up to the cap.
const MIN_MINUTES = 1;
const MAX_MINUTES = 25;

export function DurationPicker({ valueSeconds, onChange, disabled = false }) {
  const minutes = Math.round(valueSeconds / 60);

  function handleChange(e) {
    const raw = e.target.value;
    if (raw === '') return;
    const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Number(raw)));
    onChange(clamped * 60);
  }

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="text-label-md font-semibold text-on-surface">Session duration</legend>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="number"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={1}
          value={minutes}
          onChange={handleChange}
          aria-label="Session duration in minutes"
          className="w-20 rounded-lg border border-border-base bg-surface-container-lowest px-3 py-2 text-center text-label-md font-semibold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-body-sm text-text-secondary">minutes ({MIN_MINUTES}-{MAX_MINUTES})</span>
      </div>
    </fieldset>
  );
}
