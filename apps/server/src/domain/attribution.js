// Attribution mapping (W5 core unit, PHASE1_PLAN.md §5): LiveKit identity
// -> room_participants.user_id -> transcript_lines.user_id. Attribution
// itself is structural (one subscribed track = one participant, proven in
// Phase 0a) -- this is the *mapping* from that participant's LiveKit
// identity to our own user id, which is our code and exactly where a
// silent bug would put one student's words under another's name.
//
// Deliberately returns null (never a fallback/default) on no match -- a
// caller must treat that as "don't persist this line" rather than guess
// who spoke.
export function resolveSpeakerUserId(participants, livekitIdentity) {
  const match = participants.find((p) => p.livekit_identity === livekitIdentity);
  return match ? match.user_id : null;
}
