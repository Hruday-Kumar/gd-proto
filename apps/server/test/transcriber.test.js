// N4 (audit comparison, 2026-07-29): attachTranscriber()'s closeAll() used
// to fire-and-forget every per-speaker AssemblyAI socket's close() --
// agent/roomAgent.js's stopTranscriptionForRoom() had no way to know when
// the last speaker's final turn had actually been flushed. closeAll() now
// returns a promise that resolves only once every socket has finished
// closing (assemblyai.js's close(), tested separately in
// assemblyai.test.js).
//
// No coverage existed for this file before this fix (peripheral I/O glue,
// same as every other file under agent/ ported from the Phase 0a spike) --
// added here because this is the exact contract the fix depends on.
// @livekit/rtc-node and ./assemblyai.js are both mocked so this runs with
// no real LiveKit/AssemblyAI connection at all.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@livekit/rtc-node', () => ({
  RoomEvent: { TrackSubscribed: 'TrackSubscribed', TrackUnsubscribed: 'TrackUnsubscribed' },
  TrackKind: { KIND_AUDIO: 'audio' },
  AudioStream: class {
    // Never yields a frame -- these tests only care about closeAll()'s
    // own contract, not audio consumption.
    [Symbol.asyncIterator]() {
      return { next: () => new Promise(() => {}) };
    }
  },
}));

vi.mock('../src/agent/assemblyai.js', () => ({ openAssemblyAI: vi.fn() }));

const { attachTranscriber } = await import('../src/agent/transcriber.js');
const { openAssemblyAI } = await import('../src/agent/assemblyai.js');

function fakeRoom() {
  const handlers = {};
  return {
    on: vi.fn((event, cb) => {
      handlers[event] = cb;
    }),
    emit(event, ...args) {
      handlers[event]?.(...args);
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('attachTranscriber closeAll()', () => {
  it('resolves once every subscribed track\'s own close() has settled, not before', async () => {
    const deferreds = [];
    openAssemblyAI.mockImplementation(() => {
      const d = deferred();
      deferreds.push(d);
      return { send: vi.fn(), close: vi.fn().mockReturnValue(d.promise) };
    });

    const room = fakeRoom();
    const { closeAll } = attachTranscriber(room, { apiKey: 'fake-key', onTranscript: vi.fn() });

    room.emit('TrackSubscribed', { kind: 'audio' }, { sid: 'pub-1' }, { identity: 'speaker-a' });
    room.emit('TrackSubscribed', { kind: 'audio' }, { sid: 'pub-2' }, { identity: 'speaker-b' });

    let done = false;
    const closed = closeAll().then(() => {
      done = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);

    deferreds[0].resolve();
    await Promise.resolve();
    expect(done).toBe(false); // one of two still pending

    deferreds[1].resolve();
    await closed;
    expect(done).toBe(true);
  });

  it('resolves with nothing to close when no track was ever subscribed', async () => {
    const room = fakeRoom();
    const { closeAll } = attachTranscriber(room, { apiKey: 'fake-key', onTranscript: vi.fn() });
    await expect(closeAll()).resolves.toBeDefined();
  });

  it('ignores a non-audio track', async () => {
    openAssemblyAI.mockClear();
    const room = fakeRoom();
    attachTranscriber(room, { apiKey: 'fake-key', onTranscript: vi.fn() });
    room.emit('TrackSubscribed', { kind: 'video' }, { sid: 'pub-1' }, { identity: 'speaker-a' });
    expect(openAssemblyAI).not.toHaveBeenCalled();
  });
});
