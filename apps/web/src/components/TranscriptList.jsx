// Renders a room's already-fetched, already-attributed transcript lines
// (GET /api/rooms/:id/transcript). This is a fixed, complete set once a
// room has ended -- unlike LiveRoomAudio's sliding caption window, plain
// index keys are safe here.
export function TranscriptList({ lines }) {
  if (!lines || lines.length === 0) {
    return <p className="text-body-sm text-outline">No speech was transcribed in this session.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className="text-body-sm text-on-surface">
          <strong className="text-on-surface-variant">{line.displayName}:</strong> {line.text}
        </li>
      ))}
    </ul>
  );
}
