// Session length used to be a raw seconds number input ("600"), which asks
// a student to do mental arithmetic to pick a 10-minute GD. These are the
// example durations the product doc gives for GD practice, in the unit
// people actually think in; the API still takes seconds.
const OPTIONS = [5, 10, 15, 20];

export function DurationPicker({ valueSeconds, onChange, disabled = false }) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="text-label-md font-semibold text-on-surface">Session duration</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Session duration">
        {OPTIONS.map((minutes) => {
          const seconds = minutes * 60;
          const selected = seconds === valueSeconds;
          return (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(seconds)}
              className={`rounded-lg border px-6 py-2 text-label-md font-semibold transition-colors disabled:cursor-not-allowed ${
                selected
                  ? 'border-primary bg-primary-container text-on-primary-container'
                  : 'border-border-base bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {minutes} min
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
