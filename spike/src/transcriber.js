// The core Stage 2 mechanic: subscribe to EVERY participant's audio track and
// transcribe each one on its own Deepgram socket. Because each track belongs to
// exactly one participant, attribution is structural — we always know who said
// what, without any speaker-diarization guessing.
import { AudioStream, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { openDeepgram } from './deepgram.js';

// dgSampleRate: the rate we hand to Deepgram. AudioStream resamples each track
// to this rate for us, so mixed source rates don't matter.
export function attachTranscriber(room, { apiKey, onTranscript, dgSampleRate = 16000 }) {
  const active = new Map(); // key -> stop()

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    const who = {
      identity: participant.identity,
      name: participant.name || participant.identity,
    };

    const dg = openDeepgram({
      sampleRate: dgSampleRate,
      apiKey,
      onFinal: (text) => onTranscript({ ...who, text }),
      onError: (e) => console.error(`[deepgram:${who.name}] ${e.message}`),
    });

    let stopped = false;
    const stream = new AudioStream(track, { sampleRate: dgSampleRate, numChannels: 1 });
    (async () => {
      try {
        for await (const frame of stream) {
          if (stopped) break;
          dg.send(frame.data);
        }
      } catch (e) {
        if (!stopped) console.error(`[stream:${who.name}] ${e.message}`);
      }
    })();

    const key = publication.sid ?? who.identity;
    active.set(key, () => { stopped = true; dg.close(); });
  });

  room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
    const key = publication.sid;
    const stop = key && active.get(key);
    if (stop) { stop(); active.delete(key); }
  });

  return { closeAll: () => { for (const stop of active.values()) stop(); active.clear(); } };
}
