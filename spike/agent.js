// Stage 2 LIVE transcriber agent.
// Joins a room as a hidden participant, transcribes every speaker server-side
// with Deepgram, and broadcasts each attributed line back into the room as a
// data message (topic "transcript") so the web UI displays it. Also logs to
// the console.
//
// Usage:  node agent.js [roomName]     (default room: gd-test-1)
import 'dotenv/config';
import { Room } from '@livekit/rtc-node';
import { mintToken } from './src/token.js';
import { attachTranscriber } from './src/transcriber.js';

const { LIVEKIT_URL, DEEPGRAM_API_KEY } = process.env;
const roomName = process.argv[2] || process.env.ROOM || 'gd-test-1';

if (!LIVEKIT_URL || !DEEPGRAM_API_KEY) {
  console.error('[!] Need LIVEKIT_URL and DEEPGRAM_API_KEY in .env');
  process.exit(1);
}

const room = new Room();
const token = await mintToken('transcriber-bot', roomName, {
  name: 'Transcriber',
  canPublish: false,
  canSubscribe: true,
  canPublishData: true,
  hidden: true, // don't show up in the participant list or get subscribed to
});
await room.connect(LIVEKIT_URL, token, { autoSubscribe: true, dynacast: true });
console.log(`[agent] joined "${roomName}" — transcribing all speakers. Ctrl+C to stop.`);

const enc = new TextEncoder();
attachTranscriber(room, {
  apiKey: DEEPGRAM_API_KEY,
  onTranscript: ({ name, identity, text }) => {
    console.log(`TRANSCRIPT | ${name} | ${text}`);
    const payload = enc.encode(JSON.stringify({ type: 'transcript', speaker: name, identity, text }));
    room.localParticipant.publishData(payload, { reliable: true, topic: 'transcript' });
  },
});

process.on('SIGINT', async () => {
  console.log('\n[agent] leaving…');
  await room.disconnect();
  process.exit(0);
});
