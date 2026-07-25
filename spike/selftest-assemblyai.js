// ── P2 pre-flight smoke test: AssemblyAI vendor swap ────────────────────
// Same headless test as selftest.js (3 bot speakers, known sentences,
// assert correct + non-leaked attribution) but transcribing with
// AssemblyAI's Universal-Streaming instead of Deepgram — reconfirms
// ADR-0002's vendor pivot before Phase 1 (W5) builds real transcription on
// it. Exit code 0 = PASS, 1 = FAIL. Run with: npm run selftest:assemblyai
import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Room } from '@livekit/rtc-node';
import { mintToken } from './src/token.js';
import { attachTranscriberAssemblyAI } from './src/transcriber-assemblyai.js';
import { runSpeakerBot } from './src/speaker-bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const media = (f) => join(__dirname, 'media', f);
const { LIVEKIT_URL, ASSEMBLYAI_API_KEY } = process.env;

if (!LIVEKIT_URL || !ASSEMBLYAI_API_KEY) {
  console.error('[!] Need LIVEKIT_URL and ASSEMBLYAI_API_KEY in .env');
  process.exit(1);
}

const ROOM = `selftest-aai-${Date.now()}`;

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

const heard = new Map();
const firstAt = new Map();
const lastAt = new Map();
let speakingStartedAt = 0;
let speakingDoneAt = 0;

async function main() {
  const tRoom = new Room();
  const tToken = await mintToken('transcriber-aai', ROOM, {
    name: 'Transcriber', canPublish: false, canSubscribe: true, canPublishData: true, hidden: true,
  });
  await tRoom.connect(LIVEKIT_URL, tToken, { autoSubscribe: true, dynacast: true });

  attachTranscriberAssemblyAI(tRoom, {
    apiKey: ASSEMBLYAI_API_KEY,
    onTranscript: ({ name, text }) => {
      const now = Date.now();
      if (!firstAt.has(name)) firstAt.set(name, now);
      lastAt.set(name, now);
      console.log(`  heard [${name}]: ${text}`);
      heard.set(name, `${heard.get(name) || ''} ${text}`.trim().toLowerCase());
    },
  });

  console.log(`\nRoom "${ROOM}": 3 bots joining and speaking (real-time), transcribing via AssemblyAI…\n`);
  speakingStartedAt = Date.now();
  const bots = await Promise.all(
    SPEAKERS.map((s) => runSpeakerBot({ roomName: ROOM, identity: s.identity, name: s.name, wavPath: s.wav })),
  );
  speakingDoneAt = Date.now();

  // Let AssemblyAI flush trailing finals after audio ends.
  await new Promise((r) => setTimeout(r, 4000));

  console.log('\n──────── RESULTS ────────');
  let pass = true;
  for (const s of SPEAKERS) {
    const got = heard.get(s.name) || '';
    const hasOwn = s.expect.every((w) => got.includes(w));
    const leaked = SPEAKERS.filter((o) => o !== s).some((o) => (heard.get(o.name) || '').includes(s.unique));
    const ok = hasOwn && !leaked;
    if (!ok) pass = false;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(6)} expected~[${s.expect.join(', ')}]` +
      `${leaked ? '  <-- "' + s.unique + '" leaked to another speaker!' : ''}\n` +
      `        got: "${got || '(nothing transcribed)'}"`,
    );
  }
  console.log(`\nOVERALL: ${pass ? 'PASS — AssemblyAI attribution works end-to-end' : 'FAIL'}`);

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
