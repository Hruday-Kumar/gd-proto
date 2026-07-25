// ── Headless self-test ────────────────────────────────────────────────
// Proves the whole Stage 2 loop with NO humans:
//   1. A hidden transcriber agent joins a fresh room.
//   2. Three bot "speakers" join and speak distinct, known sentences.
//   3. Deepgram transcribes each track; we assert each speaker's expected
//      keywords land under THAT speaker (and not under anyone else).
//
// Exit code 0 = PASS, 1 = FAIL. Run with: npm run selftest
import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Room } from '@livekit/rtc-node';
import { mintToken } from './src/token.js';
import { attachTranscriber } from './src/transcriber.js';
import { runSpeakerBot } from './src/speaker-bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const media = (f) => join(__dirname, 'media', f);
const { LIVEKIT_URL, DEEPGRAM_API_KEY } = process.env;

if (!LIVEKIT_URL || !DEEPGRAM_API_KEY) {
  console.error('[!] Need LIVEKIT_URL and DEEPGRAM_API_KEY in .env');
  process.exit(1);
}

const ROOM = `selftest-${Date.now()}`;

// Each speaker + the keywords we expect to hear, and a keyword that is UNIQUE to
// them (used to check nobody else's transcript was mis-attributed with it).
const SPEAKERS = [
  { identity: 'alice', name: 'Alice', wav: media('alice.wav'), expect: ['technology', 'education'], unique: 'education' },
  { identity: 'bob', name: 'Bob', wav: media('bob.wav'), expect: ['remote', 'work'], unique: 'remote' },
  { identity: 'carol', name: 'Carol', wav: media('carol.wav'), expect: ['social', 'media'], unique: 'social' },
];

for (const s of SPEAKERS) {
  if (!existsSync(s.wav)) {
    console.error(`[!] Missing ${s.wav}. Run:  npm run gen-voices`);
    process.exit(1);
  }
}

const heard = new Map(); // speaker name -> concatenated lowercased transcript
const firstAt = new Map(); // speaker -> ms timestamp of first transcript
const lastAt = new Map(); // speaker -> ms timestamp of latest transcript
let speakingStartedAt = 0; // when bots began joining/speaking
let speakingDoneAt = 0; // when all bots finished playing their audio

async function main() {
  const tRoom = new Room();
  const tToken = await mintToken('transcriber', ROOM, {
    name: 'Transcriber', canPublish: false, canSubscribe: true, canPublishData: true, hidden: true,
  });
  await tRoom.connect(LIVEKIT_URL, tToken, { autoSubscribe: true, dynacast: true });

  attachTranscriber(tRoom, {
    apiKey: DEEPGRAM_API_KEY,
    onTranscript: ({ name, text }) => {
      const now = Date.now();
      if (!firstAt.has(name)) firstAt.set(name, now);
      lastAt.set(name, now);
      console.log(`  heard [${name}]: ${text}`);
      heard.set(name, `${heard.get(name) || ''} ${text}`.trim().toLowerCase());
    },
  });

  console.log(`\nRoom "${ROOM}": 3 bots joining and speaking (real-time)…\n`);
  speakingStartedAt = Date.now();
  const bots = await Promise.all(
    SPEAKERS.map((s) => runSpeakerBot({ roomName: ROOM, identity: s.identity, name: s.name, wavPath: s.wav })),
  );
  speakingDoneAt = Date.now();

  // Let Deepgram flush trailing finals after audio ends.
  await new Promise((r) => setTimeout(r, 4000));

  console.log('\n──────── RESULTS ────────');
  let pass = true;
  for (const s of SPEAKERS) {
    const got = heard.get(s.name) || '';
    const hasOwn = s.expect.every((w) => got.includes(w));
    // Nobody ELSE should have this speaker's unique word attributed to them.
    const leaked = SPEAKERS.filter((o) => o !== s).some((o) => (heard.get(o.name) || '').includes(s.unique));
    const ok = hasOwn && !leaked;
    if (!ok) pass = false;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(6)} expected~[${s.expect.join(', ')}]` +
      `${leaked ? '  <-- "' + s.unique + '" leaked to another speaker!' : ''}\n` +
      `        got: "${got || '(nothing transcribed)'}"`,
    );
  }
  console.log(`\nOVERALL: ${pass ? 'PASS — per-speaker attribution works end-to-end' : 'FAIL'}`);

  // Rough latency picture (all speakers spoke concurrently for ~5s).
  console.log('\n──────── LATENCY (rough) ────────');
  for (const s of SPEAKERS) {
    const first = firstAt.get(s.name);
    const last = lastAt.get(s.name);
    if (!first) { console.log(`  ${s.name}: no transcript`); continue; }
    console.log(
      `  ${s.name.padEnd(6)} first caption ~${((first - speakingStartedAt) / 1000).toFixed(1)}s ` +
      `after speaking began · final line ~${((last - speakingDoneAt) / 1000).toFixed(1)}s after audio ended`,
    );
  }
  console.log('');

  for (const b of bots) await b.close();
  await tRoom.disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
