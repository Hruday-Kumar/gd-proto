// M10 (audit 2026-07-28). GET /api/rooms/:id/status used to lazily flip an
// expired room to 'ended' and dispatch feedback generation as a side effect
// of a read -- any retry, prefetch, or proxy replay could re-trigger it.
// This is the pure decision behind the replacement, a periodic sweep
// (agent/roomSweeper.js): given every room the DB still calls 'live' and
// the server's own clock, which ones have actually timed out.
export function findExpiredLiveRooms(rooms, now) {
  return rooms.filter((room) => room.ends_at && now >= new Date(room.ends_at).getTime());
}
