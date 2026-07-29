// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback generation as a side effect
// of a read -- any retry, prefetch, or proxy replay could re-trigger it.
// This runs the transition on a server-side timer instead, so the status
// route can go back to being a pure read. Same shape as agent/roomAgent.js's
// recoverLiveRooms(): nothing here may throw, since it runs unattended on an
// interval -- a database hiccup should just mean this tick did nothing,
// not a crashed process.
import { listLiveRooms, updateRoomStatus } from '../db/rooms.js';
import { findExpiredLiveRooms } from '../domain/roomSweep.js';
import { generateAndPersistFeedbackForRoom } from './feedbackWorker.js';

export async function sweepExpiredRooms({
  listLiveRoomsFn = listLiveRooms,
  updateRoomStatusFn = updateRoomStatus,
  generateFeedbackFn = generateAndPersistFeedbackForRoom,
  now = Date.now(),
} = {}) {
  let liveRooms;
  try {
    liveRooms = await listLiveRoomsFn();
  } catch (err) {
    console.error(`[sweep] could not read live rooms: ${err.message}`);
    return;
  }

  const expired = findExpiredLiveRooms(liveRooms, now);

  for (const room of expired) {
    let claimed;
    try {
      // Same conditional-claim contract C3 gave db/rooms.js's
      // updateRoomStatus: the write only lands if the room is still
      // 'live', so if two ticks ever overlap, only one of them wins.
      claimed = await updateRoomStatusFn(room.id, {
        status: 'ended',
        endedAt: new Date(now).toISOString(),
        expectedStatus: 'live',
      });
    } catch (err) {
      console.error(`[sweep] failed to end room ${room.id}: ${err.message}`);
      continue;
    }

    // Losing the claim is normal, not an error -- someone else already
    // ended this room. Fire-and-forget, same reasoning as the route this
    // replaced: generating feedback is real LLM network time, and a
    // failure here must not stop the rest of this tick's sweep.
    if (claimed) {
      generateFeedbackFn(room.id).catch((e) =>
        console.error(`[feedback] failed to generate feedback for room ${room.id}: ${e.message}`)
      );
    }
  }
}

// Runs sweepExpiredRooms on a timer. Returns a stop function so index.js
// can clear the interval during graceful shutdown (shutdown.js) -- an
// interval left running doesn't hold the process open by itself (see
// .unref() below), but clearing it is still the honest thing to do rather
// than leaving a dangling timer past the point the server is shutting down.
export function startRoomSweeper({ intervalMs = 3000, ...deps } = {}) {
  const interval = setInterval(() => {
    sweepExpiredRooms(deps).catch((e) => console.error(`[sweep] unexpected error: ${e.message}`));
  }, intervalMs);
  interval.unref?.();
  return () => clearInterval(interval);
}
