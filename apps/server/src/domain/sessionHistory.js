// W7 (Session history): pure assembly of a student's own past-sessions
// list from separately-fetched rooms (with embedded topic text) and
// feedback rows. Kept pure/storage-agnostic so it's testable without a
// live DB, same pattern as domain/feedbackPrompt.js.
//
// talkShareByRoomId (BE-9, SPEC-0009): optional, defaults to empty so
// every other existing caller is unaffected. A room absent from the map
// (no transcript at all) reports null, never a fabricated 0 -- same rule
// already applied to `score`.
export function buildSessionHistory(rooms, feedbackRows, talkShareByRoomId = new Map()) {
  const feedbackByRoomId = new Map(feedbackRows.map((row) => [row.room_id, row]));

  return rooms.map((room) => {
    const feedback = feedbackByRoomId.get(room.id);
    return {
      id: room.id,
      code: room.code,
      status: room.status,
      durationSeconds: room.duration_seconds,
      topicText: room.topics?.text ?? null,
      startedAt: room.started_at ?? null,
      endedAt: room.ended_at ?? null,
      feedback: feedback?.body ?? null,
      // SPEC-0006 (BE-6/BE-7): null/[] for a room with no feedback row yet
      // -- never a fabricated score, same rule as the feedback/mine route.
      score: feedback?.score ?? null,
      dimensions: feedback?.dimensions ?? [],
      strengths: feedback?.strengths ?? [],
      improvements: feedback?.improvements ?? [],
      talkShare: talkShareByRoomId.get(room.id) ?? null,
    };
  });
}
