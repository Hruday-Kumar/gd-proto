// Bug fix, 2026-07-27: startTranscriptionForRoom() had no test coverage at
// all (it constructed a real @livekit/rtc-node Room() inline, un-injectable)
// -- exactly why a real failure (LiveKit connect throwing on a transient
// network blip, confirmed live: "failed to retrieve region info: error
// sending request for url") went unnoticed until it hit a real room. The
// fix makes room construction injectable (roomFactory) and retries the
// connect call (domain/retry.js) a bounded number of times before giving up
// for real, since this class of error is a one-off network hiccup, not a
// permanent misconfiguration (proven live: the same credentials succeeded
// moments before and after the failure).
import { describe, it, expect, vi } from 'vitest';
import {
  startTranscriptionForRoom,
  stopTranscriptionForRoom,
  stopAllTranscriptions,
  recoverLiveRooms,
  getAgentWorkerStatus,
  isTranscriptionActive,
} from '../src/agent/roomAgent.js';

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function fakeRoom({ connect }) {
  return {
    connect,
    on: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    localParticipant: { publishData: vi.fn() },
  };
}

const baseOpts = {
  listParticipantsFn: async () => [],
  insertTranscriptLineFn: async () => {},
  mintTokenFn: async () => 'fake-token',
  liveKitUrl: 'wss://fake.livekit.cloud',
  assemblyaiApiKey: 'fake-key',
  connectRetryDelayMs: 0,
};

describe('startTranscriptionForRoom', () => {
  it('joins successfully on the first attempt with no retries', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const room = fakeRoom({ connect });
    const roomId = 'room-first-try';

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 0 },
      { ...baseOpts, roomFactory: () => room }
    );

    expect(connect).toHaveBeenCalledTimes(1);
    await stopTranscriptionForRoom(roomId);
  });

  it('retries a transient connect failure and still starts transcription', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('engine: signal failure: failed to retrieve region info: error sending request for url'))
      .mockResolvedValue(undefined);
    const room = fakeRoom({ connect });
    const roomId = 'room-retry-succeeds';

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 0 },
      { ...baseOpts, roomFactory: () => room }
    );

    expect(connect).toHaveBeenCalledTimes(2);
    await stopTranscriptionForRoom(roomId);
  });

  it('gives up and records a dispatch failure once every retry attempt fails', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('still down'));
    const room = fakeRoom({ connect });
    const roomId = 'room-all-attempts-fail';

    await expect(
      startTranscriptionForRoom({ id: roomId, durationSeconds: 0 }, { ...baseOpts, roomFactory: () => room, connectRetryAttempts: 3 })
    ).rejects.toThrow('still down');

    expect(connect).toHaveBeenCalledTimes(3);
    expect(getAgentWorkerStatus().getStatus().lastFailure).toMatchObject({ roomId, message: 'still down' });
  });

  // BUG-SPEC-0006 (2026-07-31): a hidden LiveKit participant is never
  // surfaced to *other* clients (confirmed via @livekit/protocol's own
  // ParticipantInfo.hidden doc comment: "indicates that it's hidden to
  // others"), so LiveRoomAudio.jsx's RoomEvent.DataReceived handler could
  // never resolve a `participant` object for the transcriber's own
  // messages once N13 (2026-07-30) started requiring one -- silently
  // dropping every live caption while transcript persistence and feedback
  // (both server-side, unaffected by this flag) kept working. Minting the
  // transcriber's token non-hidden is the fix; this locks in the grant.
  it('mints the transcriber token as non-hidden, so other clients can resolve it as the DataReceived sender', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const room = fakeRoom({ connect });
    const roomId = 'room-transcriber-visible';
    const mintTokenFn = vi.fn().mockResolvedValue('fake-token');

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 0 },
      { ...baseOpts, mintTokenFn, roomFactory: () => room }
    );

    expect(mintTokenFn).toHaveBeenCalledWith('transcriber', roomId, expect.objectContaining({ hidden: false }));
    await stopTranscriptionForRoom(roomId);
  });
});

// H2 (audit 2026-07-28): the two halves of surviving a process restart --
// letting go cleanly on the way down, and picking the room back up on the
// way up.
describe('stopTranscriptionForRoom', () => {
  it('closes the AssemblyAI sockets, not just the LiveKit connection', async () => {
    // attachTranscriber() opens one AssemblyAI socket per speaker and returns
    // a closeAll() handle for them. That handle was being dropped on the
    // floor: stopping a room disconnected LiveKit and relied on the resulting
    // TrackUnsubscribed events to tear the sockets down. During shutdown
    // those events may never arrive, leaking metered, rate-limited STT
    // connections on a free tier that caps them (LESSONS.md).
    const closeAll = vi.fn();
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });

    await startTranscriptionForRoom(
      { id: 'stt-cleanup', durationSeconds: 600 },
      { ...baseOpts, roomFactory: () => room, attachTranscriberFn: () => ({ closeAll }) }
    );
    await stopTranscriptionForRoom('stt-cleanup');

    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });
});

// N4 (audit comparison, 2026-07-29): the deterministic completion signal
// the sweeper now gates feedback generation on -- a room must not report
// itself inactive (and therefore fair game for feedback generation) until
// its agent has actually finished flushing every transcript line it
// captured, not just disconnected from LiveKit.
describe('isTranscriptionActive', () => {
  it('is false for a room that was never started', () => {
    expect(isTranscriptionActive('never-started')).toBe(false);
  });

  it('is true while a room is being transcribed, false once fully stopped', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    const roomId = 'active-flag-room';

    await startTranscriptionForRoom({ id: roomId, durationSeconds: 600 }, { ...baseOpts, roomFactory: () => room });
    expect(isTranscriptionActive(roomId)).toBe(true);

    await stopTranscriptionForRoom(roomId);
    expect(isTranscriptionActive(roomId)).toBe(false);
  });

  it('stays true until a transcript write still in flight when stop is called actually settles', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    const roomId = 'flush-race-room';
    let onTranscript;
    const attachTranscriberFn = (_room, opts) => {
      onTranscript = opts.onTranscript;
      return { closeAll: vi.fn() };
    };
    const pendingWrite = deferred();
    const insertTranscriptLineFn = vi.fn().mockReturnValue(pendingWrite.promise);

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 600 },
      {
        ...baseOpts,
        roomFactory: () => room,
        attachTranscriberFn,
        insertTranscriptLineFn,
        listParticipantsFn: async () => [{ livekit_identity: 'someone', user_id: 'user-1' }],
      }
    );

    // A final utterance arrives right as the room is ending -- its DB
    // write (pendingWrite) is still in flight.
    onTranscript({ identity: 'someone', text: 'the last word', startedAtMs: 1, endedAtMs: 2 });

    let stopped = false;
    const stopPromise = stopTranscriptionForRoom(roomId).then(() => {
      stopped = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(isTranscriptionActive(roomId)).toBe(true);
    expect(stopped).toBe(false);

    pendingWrite.resolve();
    await stopPromise;

    expect(stopped).toBe(true);
    expect(isTranscriptionActive(roomId)).toBe(false);
  });

  it('stays true until a delayed transcriber.closeAll() resolves', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    const roomId = 'delayed-close-room';
    const closeAllDeferred = deferred();
    const attachTranscriberFn = () => ({ closeAll: vi.fn().mockReturnValue(closeAllDeferred.promise) });

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 600 },
      { ...baseOpts, roomFactory: () => room, attachTranscriberFn }
    );

    let stopped = false;
    const stopPromise = stopTranscriptionForRoom(roomId).then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(isTranscriptionActive(roomId)).toBe(true);
    expect(stopped).toBe(false);

    closeAllDeferred.resolve();
    await stopPromise;

    expect(stopped).toBe(true);
    expect(isTranscriptionActive(roomId)).toBe(false);
  });

  it('a second concurrent stop call awaits the same in-flight stop rather than tearing down twice', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    const roomId = 'concurrent-stop-room';
    const closeAll = vi.fn().mockResolvedValue(undefined);
    const attachTranscriberFn = () => ({ closeAll });

    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 600 },
      { ...baseOpts, roomFactory: () => room, attachTranscriberFn }
    );

    await Promise.all([stopTranscriptionForRoom(roomId), stopTranscriptionForRoom(roomId)]);

    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });
});

// 2026-07-30 (pilot-readiness + exception-handling pass): the duration
// timer's dispatch of stopTranscriptionForRoom had no .catch() -- the only
// other caller (stopAllTranscriptions) does catch it. On Node's modern
// default, a rejected stop reached this way would be an unhandled
// rejection that crashes the whole process, not just this one room.
describe('the duration timer', () => {
  it('catches and logs, rather than leaves unhandled, a rejected stop when the timer fires', async () => {
    vi.useFakeTimers();
    try {
      const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
      room.disconnect = vi.fn().mockRejectedValue(new Error('disconnect failed'));
      const roomId = 'timer-disconnect-fails';
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await startTranscriptionForRoom({ id: roomId, durationSeconds: 60 }, { ...baseOpts, roomFactory: () => room });

      // Well past durationSeconds + the internal STOP_GRACE_MS.
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(roomId));
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

// 2026-07-30: the live-caption broadcast was also fire-and-forget with no
// error handling -- a data-channel failure here must not crash transcript
// persistence (which happens in the very same onTranscript callback,
// just above the broadcast).
describe('live caption broadcast', () => {
  async function startWithOnTranscript(room, roomId) {
    let onTranscript;
    const attachTranscriberFn = (_room, opts) => {
      onTranscript = opts.onTranscript;
      return { closeAll: vi.fn() };
    };
    await startTranscriptionForRoom(
      { id: roomId, durationSeconds: 600 },
      {
        ...baseOpts,
        roomFactory: () => room,
        attachTranscriberFn,
        listParticipantsFn: async () => [{ livekit_identity: 'someone', user_id: 'user-1' }],
      }
    );
    return () => onTranscript({ identity: 'someone', text: 'hello', startedAtMs: 1, endedAtMs: 2 });
  }

  it('catches and logs, rather than throws, when publishData fails synchronously', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    room.localParticipant.publishData = vi.fn(() => {
      throw new Error('data channel closed');
    });
    const roomId = 'caption-broadcast-throws';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fire = await startWithOnTranscript(room, roomId);

      expect(fire).not.toThrow();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(roomId));
      consoleError.mockRestore();
    } finally {
      await stopTranscriptionForRoom(roomId);
    }
  });

  it('catches and logs, rather than leaves unhandled, when publishData returns a rejected promise', async () => {
    const room = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    room.localParticipant.publishData = vi.fn().mockRejectedValue(new Error('data channel closed'));
    const roomId = 'caption-broadcast-rejects';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fire = await startWithOnTranscript(room, roomId);
      fire();
      await new Promise((resolve) => setImmediate(resolve));

      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(roomId));
      consoleError.mockRestore();
    } finally {
      await stopTranscriptionForRoom(roomId);
    }
  });
});

describe('stopAllTranscriptions', () => {
  it('disconnects every active room and empties the registry', async () => {
    const roomA = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    const roomB = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    await startTranscriptionForRoom({ id: 'shutdown-a', durationSeconds: 600 }, { ...baseOpts, roomFactory: () => roomA });
    await startTranscriptionForRoom({ id: 'shutdown-b', durationSeconds: 600 }, { ...baseOpts, roomFactory: () => roomB });

    const stopped = await stopAllTranscriptions();

    expect(stopped).toBe(2);
    expect(roomA.disconnect).toHaveBeenCalledTimes(1);
    expect(roomB.disconnect).toHaveBeenCalledTimes(1);
    // Registry really is empty -- a second sweep has nothing left to do.
    expect(await stopAllTranscriptions()).toBe(0);
  });

  it('still disconnects the remaining rooms when one disconnect fails', async () => {
    const bad = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    bad.disconnect = vi.fn().mockRejectedValue(new Error('socket already gone'));
    const good = fakeRoom({ connect: vi.fn().mockResolvedValue(undefined) });
    await startTranscriptionForRoom({ id: 'shutdown-bad', durationSeconds: 600 }, { ...baseOpts, roomFactory: () => bad });
    await startTranscriptionForRoom({ id: 'shutdown-good', durationSeconds: 600 }, { ...baseOpts, roomFactory: () => good });

    await expect(stopAllTranscriptions()).resolves.toBe(2);

    expect(good.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('recoverLiveRooms', () => {
  const NOW = Date.parse('2026-07-28T10:00:00.000Z');

  it('re-dispatches an agent for each still-live room, with the time remaining', async () => {
    const startFn = vi.fn().mockResolvedValue(undefined);
    const listLiveRoomsFn = vi.fn().mockResolvedValue([
      { id: 'r1', status: 'live', duration_seconds: 600, ends_at: new Date(NOW + 300_000).toISOString() },
      { id: 'r2', status: 'live', duration_seconds: 900, ends_at: new Date(NOW + 60_000).toISOString() },
    ]);

    const recovered = await recoverLiveRooms({ listLiveRoomsFn, startFn, now: NOW });

    expect(recovered).toEqual([
      { id: 'r1', remainingSeconds: 300 },
      { id: 'r2', remainingSeconds: 60 },
    ]);
    expect(startFn).toHaveBeenNthCalledWith(1, { id: 'r1', durationSeconds: 300 });
    expect(startFn).toHaveBeenNthCalledWith(2, { id: 'r2', durationSeconds: 60 });
  });

  it('never lets a database failure crash boot', async () => {
    const startFn = vi.fn();
    const listLiveRoomsFn = vi.fn().mockRejectedValue(new Error('supabase unreachable'));

    await expect(recoverLiveRooms({ listLiveRoomsFn, startFn, now: NOW })).resolves.toEqual([]);
    expect(startFn).not.toHaveBeenCalled();
  });

  it('keeps recovering the other rooms when one dispatch fails', async () => {
    const startFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('livekit down'))
      .mockResolvedValue(undefined);
    const listLiveRoomsFn = vi.fn().mockResolvedValue([
      { id: 'r1', status: 'live', duration_seconds: 600, ends_at: new Date(NOW + 300_000).toISOString() },
      { id: 'r2', status: 'live', duration_seconds: 600, ends_at: new Date(NOW + 300_000).toISOString() },
    ]);

    await recoverLiveRooms({ listLiveRoomsFn, startFn, now: NOW });

    expect(startFn).toHaveBeenCalledTimes(2);
  });
});
