// Subscribes to every participant's audio track in a LiveKit room and
// transcribes each one with its own AssemblyAI socket -- attribution is
// structural (one track = one participant, proven in Phase 0a), ported
// from spike/src/transcriber-assemblyai.js. onTranscript gets the raw
// LiveKit identity + text + timing; mapping that identity to our own
// user_id happens one layer up (handleTranscript.js), not here.
import { AudioStream, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { openAssemblyAI } from './assemblyai.js';

export function attachTranscriber(room, { apiKey, onTranscript, sampleRate = 16000 }) {
  const active = new Map(); // publication sid -> stop()

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    const identity = participant.identity;
    const aai = openAssemblyAI({
      sampleRate,
      apiKey,
      onFinal: (text, timing) => onTranscript({ identity, text, ...timing }),
      onError: (e) => console.error(`[assemblyai:${identity}] ${e.message}`),
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
        if (!stopped) console.error(`[stream:${identity}] ${e.message}`);
      }
    })();

    // N4 (audit comparison, 2026-07-29): stop() now returns aai.close()'s
    // own promise -- closeAll() below awaits every one, so a caller (agent/
    // roomAgent.js's stopTranscriptionForRoom) can know once every speaker's
    // socket has genuinely finished flushing, not just been told to.
    const key = publication.sid ?? identity;
    active.set(key, () => {
      stopped = true;
      return aai.close();
    });
  });

  room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
    const key = publication.sid;
    const stop = key && active.get(key);
    if (stop) { stop(); active.delete(key); }
  });

  return {
    closeAll: () => {
      const stops = [...active.values()].map((stop) => stop());
      active.clear();
      return Promise.allSettled(stops);
    },
  };
}
