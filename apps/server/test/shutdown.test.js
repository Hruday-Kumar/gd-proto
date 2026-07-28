// H2 (audit 2026-07-28). There was no SIGTERM/SIGINT handler anywhere in
// apps/server, so every Render deploy killed live sessions mid-discussion:
// the process died with LiveKit and AssemblyAI sockets still open, no agent
// disconnect, and no chance for the last speaker's turn to flush.
//
// The handler itself is what needs testing, not the process.on() wiring --
// so it's built as a factory taking the server, the stop function and exit,
// all injectable, and index.js only registers it.
import { describe, it, expect, vi } from 'vitest';
import { createGracefulShutdown } from '../src/shutdown.js';

function fakeServer() {
  return { close: vi.fn((cb) => cb()) };
}

describe('createGracefulShutdown', () => {
  it('stops every active transcription and closes the server, then exits 0', async () => {
    const server = fakeServer();
    const stopAllTranscriptions = vi.fn().mockResolvedValue(2);
    const exit = vi.fn();

    await createGracefulShutdown({ server, stopAllTranscriptions, exit })('SIGTERM');

    expect(stopAllTranscriptions).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ignores a repeat signal already in flight', async () => {
    // Render sends SIGTERM and, if the process lingers, follows up. Running
    // the teardown twice would double-disconnect rooms mid-flush.
    const server = fakeServer();
    const stopAllTranscriptions = vi.fn().mockResolvedValue(0);
    const exit = vi.fn();
    const shutdown = createGracefulShutdown({ server, stopAllTranscriptions, exit });

    await Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')]);

    expect(stopAllTranscriptions).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('still closes the server and exits when stopping transcriptions throws', async () => {
    // A failed LiveKit disconnect must not strand the process: the platform
    // will SIGKILL it anyway, and an un-closed server is strictly worse.
    const server = fakeServer();
    const stopAllTranscriptions = vi.fn().mockRejectedValue(new Error('livekit disconnect failed'));
    const exit = vi.fn();

    await createGracefulShutdown({ server, stopAllTranscriptions, exit })('SIGTERM');

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('force-exits non-zero if teardown hangs past the deadline', async () => {
    // The whole point of a graceful path is that it is bounded. An agent
    // disconnect that never resolves must not hold the process open until the
    // platform SIGKILLs it.
    vi.useFakeTimers();
    const server = fakeServer();
    const stopAllTranscriptions = vi.fn(() => new Promise(() => {})); // never settles
    const exit = vi.fn();

    createGracefulShutdown({ server, stopAllTranscriptions, exit, forceExitMs: 5000 })('SIGTERM');
    await vi.advanceTimersByTimeAsync(5000);

    expect(exit).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
