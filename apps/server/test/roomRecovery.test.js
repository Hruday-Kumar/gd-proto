// H2 (audit 2026-07-28) core unit. When the process dies mid-session -- a
// Render deploy, free-tier sleep, or a crash -- the in-memory activeRooms map
// in agent/roomAgent.js is lost, but the room row still says status = 'live'.
// Browsers stay connected and students notice nothing, while zero transcript
// lines are written for the rest of the session.
//
// This is the pure decision behind boot recovery: given every room the DB
// still calls 'live' and the server's own clock, which ones should get a
// transcription agent re-attached, and for how much longer. Kept pure (no DB,
// no LiveKit) because the "how much time is left" arithmetic is the part that
// is easy to get wrong and expensive to debug live -- passing the room's
// ORIGINAL duration to a recovered agent would set its stop timer running from
// scratch, transcribing well past the room's real end.
import { describe, it, expect } from 'vitest';
import { roomsNeedingAgent } from '../src/domain/roomRecovery.js';

const NOW = Date.parse('2026-07-28T10:00:00.000Z');

function liveRoom(overrides = {}) {
  return {
    id: 'room-1',
    status: 'live',
    duration_seconds: 600,
    started_at: new Date(NOW - 60_000).toISOString(),
    ends_at: new Date(NOW + 540_000).toISOString(),
    ...overrides,
  };
}

describe('roomsNeedingAgent', () => {
  it('re-attaches a live room using the time REMAINING, not its original duration', () => {
    // 600s room, 60s already elapsed -> the recovered agent must stop in 540s.
    const result = roomsNeedingAgent([liveRoom()], NOW);

    expect(result).toEqual([{ id: 'room-1', remainingSeconds: 540 }]);
  });

  it('ignores rooms that are not live', () => {
    const rooms = [
      liveRoom({ id: 'waiting-room', status: 'waiting', started_at: null, ends_at: null }),
      liveRoom({ id: 'ended-room', status: 'ended' }),
    ];

    expect(roomsNeedingAgent(rooms, NOW)).toEqual([]);
  });

  it('ignores a live room whose timer has already expired', () => {
    // Nothing to transcribe -- the next status poll will flip it to 'ended'.
    // Re-attaching would burn an AssemblyAI connection for a dead session.
    const rooms = [liveRoom({ id: 'expired', ends_at: new Date(NOW - 1000).toISOString() })];

    expect(roomsNeedingAgent(rooms, NOW)).toEqual([]);
  });

  it('ignores a live room with no ends_at, rather than guessing one', () => {
    // Shouldn't happen (POST /start always writes ends_at), but without it
    // there is no server-authoritative stop time -- and guardrail #10 says
    // don't invent one. A room with no stop time would leave an agent
    // connected indefinitely.
    const rooms = [liveRoom({ id: 'no-ends-at', ends_at: null })];

    expect(roomsNeedingAgent(rooms, NOW)).toEqual([]);
  });

  it('rounds a partial second up so a nearly-finished room still gets its tail', () => {
    const rooms = [liveRoom({ id: 'almost-done', ends_at: new Date(NOW + 1500).toISOString() })];

    expect(roomsNeedingAgent(rooms, NOW)).toEqual([{ id: 'almost-done', remainingSeconds: 2 }]);
  });

  it('returns every live room that qualifies, not just the first', () => {
    const rooms = [
      liveRoom({ id: 'a', ends_at: new Date(NOW + 100_000).toISOString() }),
      liveRoom({ id: 'ended', status: 'ended' }),
      liveRoom({ id: 'b', ends_at: new Date(NOW + 200_000).toISOString() }),
    ];

    expect(roomsNeedingAgent(rooms, NOW)).toEqual([
      { id: 'a', remainingSeconds: 100 },
      { id: 'b', remainingSeconds: 200 },
    ]);
  });

  it('handles an empty room list', () => {
    expect(roomsNeedingAgent([], NOW)).toEqual([]);
  });
});
