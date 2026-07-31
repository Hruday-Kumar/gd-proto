// Mimics TranscriptList's actual <ul><li>speaker: text</li></ul> shape so
// swapping this for the real thing causes no layout jump. Widths vary per
// row so it reads as placeholder content, not a repeated bar.
const ROW_WIDTHS = ['w-11/12', 'w-4/5', 'w-3/5'];

export function TranscriptSkeleton() {
  return (
    <ul className="animate-pulse space-y-2.5" data-testid="transcript-skeleton" aria-hidden="true">
      {ROW_WIDTHS.map((width, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="h-3 w-16 shrink-0 rounded bg-surface-container-high" />
          <span className={`h-3 rounded bg-surface-container-high ${width}`} />
        </li>
      ))}
    </ul>
  );
}
