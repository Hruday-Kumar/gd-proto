// BE-1 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0004): pure
// assembly of a browsable open-rooms list from separately-fetched rooms
// (with embedded topic text), participant rows, and host profiles. Kept
// pure/storage-agnostic so it's testable without a live DB, same pattern
// as domain/sessionHistory.js's buildSessionHistory.
//
// R2 (SPEC-0004): a room already at its own capacity is filtered out here
// -- this list only shows rooms a caller could actually join right now,
// not just rooms that technically exist.
export function buildOpenRoomsList(rooms, participantRows, profiles) {
  const countByRoomId = new Map();
  for (const row of participantRows) {
    countByRoomId.set(row.room_id, (countByRoomId.get(row.room_id) ?? 0) + 1);
  }
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));

  return rooms
    .map((room) => ({
      id: room.id,
      code: room.code,
      topicText: room.topics?.text ?? null,
      durationSeconds: room.duration_seconds,
      maxParticipants: room.max_participants,
      participantCount: countByRoomId.get(room.id) ?? 0,
      hostDisplayName: nameById.get(room.created_by) || room.created_by,
      createdAt: room.created_at,
    }))
    .filter((room) => room.participantCount < room.maxParticipants);
}
