// One AssemblyAI Universal-Streaming (v3) WebSocket per audio stream — the
// AssemblyAI counterpart to deepgram.js. Same shape (feed linear16 PCM
// frames, get onFinal(text) callbacks) so it's a drop-in swap for the smoke
// test in P2 (ADR-0002 pivoted the real STT vendor from Deepgram to
// AssemblyAI; this file exists to reconfirm attribution/latency against the
// new vendor before Phase 1 builds on it for real).
import WebSocket from 'ws';

const AAI_URL = 'wss://streaming.assemblyai.com/v3/ws';

export function openAssemblyAI({ sampleRate, apiKey, onFinal, onError, chunkMs = 100 }) {
  const params = new URLSearchParams({
    sample_rate: String(sampleRate),
    encoding: 'pcm_s16le',
    format_turns: 'true', // punctuation/casing on finalized turns, like Deepgram's smart_format
  });

  const ws = new WebSocket(`${AAI_URL}?${params.toString()}`, {
    headers: { Authorization: apiKey }, // no "Bearer " prefix — AssemblyAI wants the raw key
  });

  let open = false;
  const backlog = [];
  ws.on('open', () => {
    open = true;
    for (const b of backlog) ws.send(b);
    backlog.length = 0;
  });

  // AssemblyAI v3 rejects any single message outside 50-1000ms of audio
  // (error 3007) — unlike Deepgram, which accepts any chunk size. LiveKit
  // hands us ~10ms frames, so we buffer up to `chunkMs` worth before sending.
  const samplesPerChunk = Math.round((sampleRate * chunkMs) / 1000);
  let pending = new Int16Array(0);
  const flush = (bytes) => {
    if (open) ws.send(bytes);
    else backlog.push(bytes);
  };
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== 'Turn') return;
      if (msg.end_of_turn && msg.transcript) onFinal(msg.transcript);
    } catch { /* ignore keepalives / non-JSON */ }
  });
  ws.on('error', (e) => onError?.(e));

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
      // Only flush the remainder if it clears AssemblyAI's 50ms floor —
      // a too-short final chunk would just trigger another 3007 error.
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
