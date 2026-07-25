// Send 3 simulated speakers into a LIVE room so you can watch them talk and get
// transcribed in the browser. Pair with `npm run agent <room>` and a browser
// tab joined to the same room.
//
// Usage:  node bots.js [roomName]     (default room: gd-test-1)
import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSpeakerBot } from './src/speaker-bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const media = (f) => join(__dirname, 'media', f);
const roomName = process.argv[2] || 'gd-test-1';

const speakers = [
  { identity: 'alice', name: 'Alice (bot)', wavPath: media('alice.wav') },
  { identity: 'bob', name: 'Bob (bot)', wavPath: media('bob.wav') },
  { identity: 'carol', name: 'Carol (bot)', wavPath: media('carol.wav') },
];

console.log(`Sending ${speakers.length} speaking bots into "${roomName}"…`);
const bots = await Promise.all(speakers.map((s) => runSpeakerBot({ roomName, ...s })));
console.log('Bots finished speaking. Leaving in 3s.');
await new Promise((r) => setTimeout(r, 3000));
for (const b of bots) await b.close();
process.exit(0);
