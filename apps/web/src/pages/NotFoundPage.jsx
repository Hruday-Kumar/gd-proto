import { Link } from 'react-router';

// Catch-all for any unmatched URL -- a mistyped room link used to render a
// completely blank page with no way back.
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <span className="material-symbols-outlined text-4xl text-outline">explore_off</span>
      <h1 className="text-headline-lg font-bold text-on-surface">Page not found</h1>
      <p className="max-w-sm text-body-md text-text-secondary">
        That link doesn&apos;t point anywhere in PlaceMe. If you were given a room code, join the room from the home
        page instead.
      </p>
      <Link
        to="/"
        className="mt-3 rounded-lg bg-primary px-8 py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  );
}
