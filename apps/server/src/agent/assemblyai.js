// One AssemblyAI Universal-Streaming (v3) WebSocket per subscribed audio
// track. Ported from the validated Phase 0a/P2 spike
// (spike/src/assemblyai.js, spike/src/transcriber-assemblyai.js) with one
// addition: each finalized turn now reports its own start/end wall-clock
// time (startedAtMs/endedAtMs) for transcript_lines, tracked from the
// first partial Turn message we see after the previous turn finalized.
import WebSocket from 'ws';

const AAI_URL = 'wss://streaming.assemblyai.com/v3/ws';

export function openAssemblyAI({ sampleRate, apiKey, onFinal, onError, chunkMs = 50 }) {
  const params = new URLSearchParams({
    sample_rate: String(sampleRate),
    encoding: 'pcm_s16le',
    format_turns: 'true',
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
  const backlog = [];
  ws.on('open', () => {
    open = true;
    for (const b of backlog) ws.send(b);
    backlog.length = 0;
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
  ws.on('error', (e) => onError?.(e));

  // AssemblyAI v3 rejects any single message outside 50-1000ms of audio
  // (error 3007) -- LiveKit hands us ~10ms frames, so buffer up to
  // `chunkMs` worth before sending (same gotcha the P2 smoke test hit).
  const samplesPerChunk = Math.round((sampleRate * chunkMs) / 1000);
  let pending = new Int16Array(0);
  const flush = (bytes) => {
    if (open) ws.send(bytes);
    else backlog.push(bytes);
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
    close() {
      const minSamples = Math.round((sampleRate * 50) / 1000);
      if (pending.length >= minSamples) {
        flush(Buffer.from(pending.buffer, pending.byteOffset, pending.byteLength));
      }
      pending = new Int16Array(0);
      try {
        if (open) ws.send(JSON.stringify({ type: 'Terminate' }));
      } catch { /* noop */ }
      try { ws.close(); } catch { /* noop */ }
    },
  };
}
