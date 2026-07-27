export function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-container-low px-3 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <span className="material-symbols-outlined text-on-primary">forum</span>
        </div>
        <span className="text-headline-sm font-bold text-primary">PlaceMe</span>
      </div>

      <main className="w-full max-w-md">
        <div className="rounded-xl border border-border-base bg-surface-container-lowest p-12 shadow-sm">
          {children}
        </div>
      </main>

      <p className="mt-8 text-label-sm text-outline">GD Arena — live group discussion practice</p>
    </div>
  );
}
