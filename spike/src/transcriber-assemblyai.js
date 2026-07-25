// Same structural-attribution mechanic as transcriber.js (one Deepgram
// socket per subscribed track) but wired to AssemblyAI instead — used only
// by the P2 smoke test (selftest-assemblyai.js) to reconfirm attribution
// and latency against the vendor ADR-0002 pivoted to. transcriber.js /
// deepgram.js are left untouched as the documented working fallback.
import { AudioStream, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { openAssemblyAI } from './assemblyai.js';

export function attachTranscriberAssemblyAI(room, { apiKey, onTranscript, sampleRate = 16000 }) {
  const active = new Map(); // key -> stop()

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    const who = {
      identity: participant.identity,
      name: participant.name || participant.identity,
    };

    const aai = openAssemblyAI({
      sampleRate,
      apiKey,
      onFinal: (text) => onTranscript({ ...who, text }),
      onError: (e) => console.error(`[assemblyai:${who.name}] ${e.message}`),
    });

    let stopped = false;
    const stream = new AudioStream(track, { sampleRate, numChannels: 1 });
    (async () => {
      try {
        for await (const frame of stream) {
          if (stopped) break;
          aai.send(frame.data);
        }
      } catch (e) {
        if (!stopped) console.error(`[stream:${who.name}] ${e.message}`);
      }
    })();

    const key = publication.sid ?? who.identity;
    active.set(key, () => { stopped = true; aai.close(); });
  });

  room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
    const key = publication.sid;
    const stop = key && active.get(key);
    if (stop) { stop(); active.delete(key); }
  });

  return { closeAll: () => { for (const stop of active.values()) stop(); active.clear(); } };
}
