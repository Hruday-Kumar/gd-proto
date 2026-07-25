// One Deepgram streaming-STT WebSocket per audio stream. We talk to Deepgram's
// realtime endpoint directly (stable, transparent) rather than via the SDK's
// generated client. Feed it linear16 PCM frames; it calls onFinal(text) with
// each finalized utterance.
import WebSocket from 'ws';

const DG_URL = 'wss://api.deepgram.com/v1/listen';

export function openDeepgram({ sampleRate, apiKey, onFinal, onError }) {
  const params = new URLSearchParams({
    model: 'nova-3',
    encoding: 'linear16',
    sample_rate: String(sampleRate),
    channels: '1',
    punctuate: 'true',
    smart_format: 'true',
    interim_results: 'false',
    endpointing: '300',
  });

  const ws = new WebSocket(`${DG_URL}?${params.toString()}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  let open = false;
  const backlog = [];
  ws.on('open', () => {
    open = true;
    for (const b of backlog) ws.send(b);
    backlog.length = 0;
  });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== 'Results') return;
      const alt = msg.channel?.alternatives?.[0];
      if (msg.is_final && alt?.transcript) onFinal(alt.transcript);
    } catch { /* ignore keepalives / non-JSON */ }
  });
  ws.on('error', (e) => onError?.(e));

  return {
    send(int16) {
      const bytes = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength);
      if (open) ws.send(bytes);
      else backlog.push(bytes);
    },
    close() {
      try {
        if (open) ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch { /* noop */ }
      try { ws.close(); } catch { /* noop */ }
    },
  };
}
