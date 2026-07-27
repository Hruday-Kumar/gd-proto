// W7 (Session history): pure assembly of a student's own past-sessions
// list from separately-fetched rooms (with embedded topic text) and
// feedback rows. Kept pure/storage-agnostic so it's testable without a
// live DB, same pattern as domain/feedbackPrompt.js.
export function buildSessionHistory(rooms, feedbackRows) {
  const feedbackByRoomId = new Map(feedbackRows.map((row) => [row.room_id, row.body]));

  return rooms.map((room) => ({
    id: room.id,
    code: room.code,
    status: room.status,
    durationSeconds: room.duration_seconds,
    topicText: room.topics?.text ?? null,
    startedAt: room.started_at ?? null,
    endedAt: room.ended_at ?? null,
    feedback: feedbackByRoomId.get(room.id) ?? null,
  }));
}
