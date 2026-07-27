// A simulated participant: joins a room and publishes a WAV clip as if it
// were a live microphone, paced in real time. Ported from the validated
// Phase 0a/P2 spike (spike/src/speaker-bot.js), using this repo's own
// mintToken (src/livekit/token.js) instead of the spike's copy.
import { Room, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioFrame } from '@livekit/rtc-node';
import { mintToken } from '../../src/livekit/token.js';
import { readWavMono16 } from './wav.js';

export async function runSpeakerBot({ roomName, identity, name = identity, wavPath, liveKitUrl }) {
  const { samples, sampleRate } = readWavMono16(wavPath);
  const token = await mintToken(identity, roomName, {
    name, canPublish: true, canSubscribe: false, canPublishData: false,
  });

  const room = new Room();
  await room.connect(liveKitUrl, token, { autoSubscribe: false, dynacast: true });

  const source = new AudioSource(sampleRate, 1);
  const track = LocalAudioTrack.createAudioTrack('speech', source);
  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_MICROPHONE;
  await room.localParticipant.publishTrack(track, opts);

  await sleep(500); // give subscribers a beat to set up before we start talking

  const frameSamples = Math.floor((sampleRate * 20) / 1000);
  for (let i = 0; i < samples.length; i += frameSamples) {
    const chunk = samples.subarray(i, Math.min(i + frameSamples, samples.length));
    await source.captureFrame(new AudioFrame(Int16Array.from(chunk), sampleRate, 1, chunk.length));
  }
  await source.waitForPlayout();

  return {
    room,
    async close() {
      try { await track.close(); } catch { /* noop */ }
      await room.disconnect();
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
