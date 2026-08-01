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
