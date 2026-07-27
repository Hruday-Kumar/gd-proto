// Anything that used to `return null` while waiting on auth/consent showed
// the student a blank white page with no explanation. This is the shared
// "we're working on it" screen those cases render instead.
export function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-on-surface-variant"
    >
      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      <p className="text-body-md">{label}</p>
    </div>
  );
}
