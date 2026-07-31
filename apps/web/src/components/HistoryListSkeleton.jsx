// Mimics HistoryPage's real layout (2 stat tiles + a few session cards) so
// the loading state reads as "your history is loading," not "the page has
// stalled." Same outer classes as the real markup -- only the content
// inside becomes pulsing placeholder bars.
const CARD_ROWS = 3;

export function HistoryListSkeleton() {
  return (
    <div className="animate-pulse" data-testid="history-list-skeleton" aria-hidden="true">
      <div className="mb-8 grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
            <div className="h-3 w-2/3 rounded bg-surface-container-high" />
            <div className="mt-3 h-6 w-1/3 rounded bg-surface-container-high" />
          </div>
        ))}
      </div>

      <ul className="space-y-6">
        {Array.from({ length: CARD_ROWS }, (_, i) => (
          <li key={i} className="rounded-xl border border-border-base bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-surface-container-high" />
                <div className="h-3 w-1/3 rounded bg-surface-container-high" />
              </div>
              <div className="h-5 w-16 rounded-full bg-surface-container-high" />
            </div>
            <div className="mt-6 h-10 rounded-lg bg-surface-container-low" />
          </li>
        ))}
      </ul>
    </div>
  );
}
