// A simulated participant: joins a room and publishes a WAV clip as if it were
// a live microphone, paced in real time. This is what lets us test a
// multi-speaker room end-to-end with zero humans.
import {
  Room, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioFrame,
} from '@livekit/rtc-node';
import { mintToken } from './token.js';
import { readWavMono16 } from './wav.js';

const { LIVEKIT_URL } = process.env;

export async function runSpeakerBot({ roomName, identity, name = identity, wavPath }) {
  const { samples, sampleRate } = readWavMono16(wavPath);
  const token = await mintToken(identity, roomName, {
    name, canPublish: true, canSubscribe: false, canPublishData: false,
  });

  const room = new Room();
  await room.connect(LIVEKIT_URL, token, { autoSubscribe: false, dynacast: true });

  const source = new AudioSource(sampleRate, 1);
  const track = LocalAudioTrack.createAudioTrack('speech', source);
  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_MICROPHONE;
  await room.localParticipant.publishTrack(track, opts);

  // Give subscribers a beat to set up before we start talking.
  await sleep(500);

  // Push 20ms frames. captureFrame() paces to real time (it resolves as the
  // playout queue drains), so a 5s clip takes ~5s — just like a live mic.
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
