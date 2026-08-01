// BE-10 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0007): pure
// aggregation of transcript_lines rows into a per-participant share of
// total attributed speaking time, as an integer percentage. Post-session
// computation only -- live/mid-session speak-time is BE-17, a separate
// harder real-time version of this same idea (SPEC-0007's Non Goals).
export function computeTalkTimeShares(transcriptLines, participantUserIds) {
  const validUserIds = new Set(participantUserIds);
  const durationByUserId = new Map(participantUserIds.map((id) => [id, 0]));

  for (const line of transcriptLines) {
    if (!validUserIds.has(line.user_id)) continue;
    const duration = Math.max(0, line.ended_at_ms - line.started_at_ms);
    durationByUserId.set(line.user_id, durationByUserId.get(line.user_id) + duration);
  }

  const totalDuration = [...durationByUserId.values()].reduce((sum, d) => sum + d, 0);
  const shareByUserId = new Map();
  for (const [userId, duration] of durationByUserId) {
    shareByUserId.set(userId, totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0);
  }
  return shareByUserId;
}

// BE-9 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0009): GET
// /api/history/mine's "my own talk share" per past session -- takes a
// flat, multi-room line list (one batched query across every history
// room, not one query per room) and reduces it to a single caller-scoped
// percentage per room_id. userId is included in each room's participant
// set explicitly, so a room where the caller was silent still reports a
// real 0 rather than being indistinguishable from "no transcript at all"
// (a room absent from the input entirely simply has no entry in the
// returned map -- the route layer maps that to null, never a fabricated
// 0, same rule already applied to `score`).
export function computeMyTalkShareByRoom(transcriptLines, userId) {
  const linesByRoomId = new Map();
  for (const line of transcriptLines) {
    if (!linesByRoomId.has(line.room_id)) linesByRoomId.set(line.room_id, []);
    linesByRoomId.get(line.room_id).push(line);
  }

  const shareByRoomId = new Map();
  for (const [roomId, lines] of linesByRoomId) {
    const participantIds = [...new Set([userId, ...lines.map((l) => l.user_id)])];
    const shares = computeTalkTimeShares(lines, participantIds);
    shareByRoomId.set(roomId, shares.get(userId) ?? 0);
  }
  return shareByRoomId;
}
