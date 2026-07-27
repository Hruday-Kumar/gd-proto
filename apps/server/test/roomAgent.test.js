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
import { startTranscriptionForRoom, stopTranscriptionForRoom, getAgentWorkerStatus } from '../src/agent/roomAgent.js';

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
});
