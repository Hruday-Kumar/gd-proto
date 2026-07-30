// N4 (audit comparison, 2026-07-29): openAssemblyAI()'s close() used to send
// "Terminate" and call ws.close() immediately after, with zero wait --
// racing AssemblyAI's own response, which can still contain the final Turn
// for whatever audio was just flushed. That final turn is exactly what
// feedback generation needs (it's the last few seconds of a discussion).
// Fixed: close() now waits for the socket's own 'close' event (letting any
// in-flight 'message' event -- including a final Turn -- get processed
// first by the handler openAssemblyAI already installs), with a bounded
// safety timeout only for a socket that never closes on its own.
//
// This file had no coverage before this fix (peripheral I/O glue, same as
// every other file under agent/ ported from the Phase 0a spike) -- added
// here because this is the exact mechanism the fix depends on. A fake `ws`
// stands in for the real module so this runs with no network at all.
import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakeWebSocket {
  constructor() {
    this.listeners = {};
    this.sent = [];
    this.forcedCloseCalls = 0;
    FakeWebSocket.instances.push(this);
  }
  on(event, cb) {
    (this.listeners[event] ??= []).push(cb);
    return this;
  }
  once(event, cb) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      cb(...args);
    };
    return this.on(event, wrapped);
  }
  off(event, cb) {
    this.listeners[event] = (this.listeners[event] || []).filter((l) => l !== cb);
    return this;
  }
  emit(event, ...args) {
    [...(this.listeners[event] || [])].forEach((cb) => cb(...args));
  }
  send(data) {
    this.sent.push(data);
  }
  // Simulates the real ws library: calling close() ourselves also
  // eventually raises the 'close' event.
  close() {
    this.forcedCloseCalls += 1;
    this.emit('close');
  }
}
FakeWebSocket.instances = [];

vi.mock('ws', () => ({ default: FakeWebSocket }));

const { openAssemblyAI } = await import('../src/agent/assemblyai.js');

beforeEach(() => {
  FakeWebSocket.instances.length = 0;
});

function openSocket(opts = {}) {
  const aai = openAssemblyAI({ sampleRate: 16000, apiKey: 'fake-key', onFinal: vi.fn(), onError: vi.fn(), ...opts });
  const ws = FakeWebSocket.instances[0];
  ws.emit('open');
  return { aai, ws };
}

describe('openAssemblyAI close()', () => {
  it('does not resolve until the socket actually closes', async () => {
    const { aai, ws } = openSocket();

    let resolved = false;
    const closed = aai.close().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(ws.sent.some((m) => JSON.parse(m).type === 'Terminate')).toBe(true);

    ws.emit('close'); // AssemblyAI itself closes the connection once it's flushed
    await closed;
    expect(resolved).toBe(true);
  });

  it('still delivers a final Turn message that arrives after Terminate but before close', async () => {
    const onFinal = vi.fn();
    const { aai, ws } = openSocket({ onFinal });

    const closed = aai.close();

    // The server's final result for the last few seconds of audio, arriving
    // after we sent Terminate but before it closes the socket.
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'Turn', end_of_turn: true, transcript: 'the last word' })));
    ws.emit('close');

    await closed;
    expect(onFinal).toHaveBeenCalledWith('the last word', expect.any(Object));
  });

  it('falls back to a bounded safety close if the socket never closes on its own', async () => {
    vi.useFakeTimers();
    try {
      const { aai, ws } = openSocket();

      let resolved = false;
      const closed = aai.close().then(() => {
        resolved = true;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(2500);
      await closed;

      expect(resolved).toBe(true);
      expect(ws.forcedCloseCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves immediately when the socket never even opened', async () => {
    const aai = openAssemblyAI({ sampleRate: 16000, apiKey: 'fake-key', onFinal: vi.fn(), onError: vi.fn() });
    await expect(aai.close()).resolves.toBeUndefined();
  });
});
