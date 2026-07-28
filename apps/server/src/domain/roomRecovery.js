// Boot-recovery decision (H2, audit 2026-07-28). Pure by design: given every
// room the database still calls 'live' and the server's own clock, decide
// which ones still need a transcription agent and for how much longer.
//
// The remaining-time arithmetic is the whole point. agent/roomAgent.js sets
// its stop timer as `durationSeconds` from the moment it connects, so handing
// a recovered agent the room's ORIGINAL duration would restart that clock from
// scratch and keep transcribing long past the room's real end. ends_at is the
// server-authoritative stop time (written once by POST /api/rooms/:id/start),
// so remaining time is measured against that, never recomputed from duration.
import { SESSION_STATUS } from './sessionStateMachine.js';

export function roomsNeedingAgent(rooms, now) {
  const needing = [];

  for (const room of rooms) {
    if (room.status !== SESSION_STATUS.LIVE) continue;
    // No stop time means no server-authoritative end. Skip rather than invent
    // one (guardrail #10) -- an agent with no stop timer stays connected
    // indefinitely, which is worse than no agent at all.
    if (!room.ends_at) continue;

    const remainingMs = new Date(room.ends_at).getTime() - now;
    // Already expired: there is nothing left to transcribe, and the next
    // status poll flips it to 'ended'. Re-attaching would spend a LiveKit and
    // an AssemblyAI connection (rate-limited, see LESSONS.md) on a dead
    // session.
    if (!(remainingMs > 0)) continue;

    needing.push({ id: room.id, remainingSeconds: Math.ceil(remainingMs / 1000) });
  }

  return needing;
}
