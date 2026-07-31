export function ButtonBusyLabel({ label }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="material-symbols-outlined animate-spin text-base" aria-hidden="true">
        progress_activity
      </span>
      {label}
    </span>
  );
}
