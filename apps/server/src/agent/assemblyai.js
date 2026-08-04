// One AssemblyAI Universal-Streaming (v3) WebSocket per subscribed audio
// track. Ported from the validated Phase 0a/P2 spike
// (spike/src/assemblyai.js, spike/src/transcriber-assemblyai.js) with one
// addition: each finalized turn now reports its own start/end wall-clock
// time (startedAtMs/endedAtMs) for transcript_lines, tracked from the
// first partial Turn message we see after the previous turn finalized.
import WebSocket from 'ws';

const AAI_URL = 'wss://streaming.assemblyai.com/v3/ws';

export function openAssemblyAI({ sampleRate, apiKey, onFinal, onError, chunkMs = 50, connectTimeoutMs = 10_000 }) {
  const params = new URLSearchParams({
    sample_rate: String(sampleRate),
    encoding: 'pcm_s16le',
    format_turns: 'true',
    // Explicit English-only model (2026-07-28 fix): AssemblyAI's own
    // default when speech_model is omitted is now "universal-3-5-pro",
    // which code-switches across 18 languages -- that's what was causing
    // GD sessions (spoken in English, sometimes with an Indian accent) to
    // come back transcribed in other languages. "universal-streaming-
    // english" is the only model AssemblyAI's docs describe as English-only.
    speech_model: 'universal-streaming-english',
    // AssemblyAI's own defaults (min_turn_silence 400ms) finalize a turn
    // noticeably slower than the 300ms endpointing we use for Deepgram
    // (spike/src/deepgram.js) -- matched here so the two paths are
    // comparably responsive. AssemblyAI recommends going higher (560ms)
    // for multi-speaker captioning to avoid splitting a turn on a
    // mid-sentence pause; 300ms trades a little of that safety margin
    // for lower perceived caption latency, since GD Arena's whole point
    // is fast back-and-forth turns.
    min_turn_silence: '300',
  });

  const ws = new WebSocket(`${AAI_URL}?${params.toString()}`, {
    headers: { Authorization: apiKey }, // no "Bearer " prefix -- AssemblyAI wants the raw key
  });

  let open = false;
  // Phase 1 (ACTION_PLAN.md, 2026-08-04): once true, this stream is dead --
  // set on a socket error or on the connect deadline firing. send() stops
  // backlogging and close() resolves immediately instead of running the
  // full Terminate/wait-for-close handshake against a connection already
  // known to be broken.
  let failed = false;
  const backlog = [];
  let backlogBytes = 0;
  // Bounds how much audio can queue up before the socket actually opens --
  // previously unbounded, so a slow/hung connect leaked memory for as long
  // as the room's transcription ran, per participant stream. Whichever is
  // smaller: 512KiB, or 10s of this stream's own audio (2 bytes/sample,
  // PCM16 mono) -- the flat byte cap protects against an unusually high
  // sample rate; the duration cap is what actually binds at typical voice
  // sample rates.
  const maxBacklogBytes = Math.min(512 * 1024, sampleRate * 2 * 10);

  const markFailed = (err) => {
    if (failed) return;
    failed = true;
    backlog.length = 0;
    backlogBytes = 0;
    clearTimeout(connectTimer);
    onError?.(err);
  };

  const connectTimer = setTimeout(() => {
    if (open || failed) return;
    markFailed(new Error(`AssemblyAI connection timed out after ${connectTimeoutMs}ms`));
    try { ws.close(); } catch { /* noop */ }
  }, connectTimeoutMs);
  connectTimer.unref?.();

  ws.on('open', () => {
    if (failed) return; // connect deadline already fired; ignore a late open
    clearTimeout(connectTimer);
    open = true;
    for (const b of backlog) ws.send(b);
    backlog.length = 0;
    backlogBytes = 0;
  });

  let turnStartedAtMs = null;
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== 'Turn') return;
      if (turnStartedAtMs === null) turnStartedAtMs = Date.now();
      if (msg.end_of_turn && msg.transcript) {
        onFinal(msg.transcript, { startedAtMs: turnStartedAtMs, endedAtMs: Date.now() });
        turnStartedAtMs = null;
      }
    } catch { /* ignore keepalives / non-JSON */ }
  });
  ws.on('error', (e) => markFailed(e));

  // AssemblyAI v3 rejects any single message outside 50-1000ms of audio
  // (error 3007) -- LiveKit hands us ~10ms frames, so buffer up to
  // `chunkMs` worth before sending (same gotcha the P2 smoke test hit).
  const samplesPerChunk = Math.round((sampleRate * chunkMs) / 1000);
  let pending = new Int16Array(0);
  const flush = (bytes) => {
    if (failed) return;
    if (open) {
      ws.send(bytes);
      return;
    }
    if (backlogBytes + bytes.length > maxBacklogBytes) return; // still connecting -- drop rather than grow forever
    backlog.push(bytes);
    backlogBytes += bytes.length;
  };

  return {
    send(int16) {
      const merged = new Int16Array(pending.length + int16.length);
      merged.set(pending);
      merged.set(int16, pending.length);
      pending = merged;

      while (pending.length >= samplesPerChunk) {
        const chunk = pending.subarray(0, samplesPerChunk);
        flush(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        pending = pending.slice(samplesPerChunk);
      }
    },
    // N4 (audit comparison, 2026-07-29): used to send "Terminate" and call
    // ws.close() immediately after, with zero wait -- racing AssemblyAI's
    // own response, which can still contain the final Turn for whatever
    // audio was just flushed (exactly the last few seconds of a
    // discussion feedback generation needs). Now waits for the socket's
    // own 'close' event -- the 'message' handler above stays registered
    // and keeps processing any final Turn that arrives in the meantime --
    // with a bounded safety close only for a socket that never closes on
    // its own.
    close() {
      if (failed) {
        try { ws.close(); } catch { /* noop */ }
        return Promise.resolve();
      }

      const minSamples = Math.round((sampleRate * 50) / 1000);
      if (pending.length >= minSamples) {
        flush(Buffer.from(pending.buffer, pending.byteOffset, pending.byteLength));
      }
      pending = new Int16Array(0);

      if (!open) {
        try { ws.close(); } catch { /* noop */ }
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(safetyTimer);
          resolve();
        };

        ws.once('close', finish);
        const safetyTimer = setTimeout(() => {
          try { ws.close(); } catch { /* noop */ }
          finish();
        }, 2000);

        try {
          ws.send(JSON.stringify({ type: 'Terminate' }));
        } catch {
          finish();
        }
      });
    },
  };
}
