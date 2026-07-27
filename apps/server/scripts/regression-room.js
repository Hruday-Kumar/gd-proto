// ── W5 regression harness (PHASE1_PLAN.md §5 W5) ───────────────────────
// Re-verifies the WHOLE agent pipeline -- real LiveKit room, real
// AssemblyAI transcription, real attribution mapping -- with bots and
// zero humans, adapted from the Phase 0a/P2 spike (spike/selftest-
// assemblyai.js). Exercises the actual production entry point,
// startTranscriptionForRoom(), with only the DB write faked (recorded
// in-memory instead of a real Supabase room/participants/transcript_lines
// fixture) so it's runnable standalone.
//
// This is NOT guardrail #1's human-verification gate -- it proves the
// code path works, not that real people using real devices get correctly
// attributed feedback. Run with: npm run regression:room
import 'dotenv/config';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { startTranscriptionForRoom, stopTranscriptionForRoom } from '../src/agent/roomAgent.js';
import { runSpeakerBot } from './regression/speakerBot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const media = (f) => join(__dirname, 'regression', 'media', f);
const { LIVEKIT_URL, ASSEMBLYAI_API_KEY } = process.env;

if (!LIVEKIT_URL || !ASSEMBLYAI_API_KEY) {
  console.error('[!] Need LIVEKIT_URL and ASSEMBLYAI_API_KEY in apps/server/.env');
  process.exit(1);
}

const ROOM = `regression-w5-${Date.now()}`;
const DURATION_SECONDS = 30; // generous headroom; we stop early once bots + grace are done

const SPEAKERS = [
  { identity: 'user-alice', name: 'Alice', wav: media('alice.wav'), expect: ['technology', 'education'], unique: 'education' },
  { identity: 'user-bob', name: 'Bob', wav: media('bob.wav'), expect: ['remote', 'work'], unique: 'remote' },
  { identity: 'user-carol', name: 'Carol', wav: media('carol.wav'), expect: ['social', 'media'], unique: 'social' },
];

for (const s of SPEAKERS) {
  if (!existsSync(s.wav)) {
    console.error(`[!] Missing ${s.wav}`);
    process.exit(1);
  }
}

const participants = SPEAKERS.map((s) => ({ user_id: s.identity, livekit_identity: s.identity }));
const recorded = [];
const heard = new Map();
const firstAt = new Map();
const lastAt = new Map();

async function insertTranscriptLineFn(line) {
  recorded.push(line);
  const now = Date.now();
  if (!firstAt.has(line.userId)) firstAt.set(line.userId, now);
  lastAt.set(line.userId, now);
  heard.set(line.userId, `${heard.get(line.userId) || ''} ${line.text}`.trim().toLowerCase());
  console.log(`  heard [${line.userId}]: ${line.text}`);
  return { id: `local-${recorded.length}`, ...line };
}

async function main() {
  await startTranscriptionForRoom(
    { id: ROOM, durationSeconds: DURATION_SECONDS },
    { listParticipantsFn: async () => participants, insertTranscriptLineFn }
  );

  console.log(`\nRoom "${ROOM}": 3 bots joining and speaking (real-time), transcribing via the real W5 agent pipeline…\n`);
  const speakingStartedAt = Date.now();
  const bots = await Promise.all(
    SPEAKERS.map((s) => runSpeakerBot({ roomName: ROOM, identity: s.identity, name: s.name, wavPath: s.wav, liveKitUrl: LIVEKIT_URL }))
  );
  const speakingDoneAt = Date.now();

  await new Promise((r) => setTimeout(r, 4000)); // let AssemblyAI flush trailing finals

  console.log('\n──────── RESULTS ────────');
  let pass = true;
  for (const s of SPEAKERS) {
    const got = heard.get(s.identity) || '';
    const hasOwn = s.expect.every((w) => got.includes(w));
    const leaked = SPEAKERS.filter((o) => o !== s).some((o) => (heard.get(o.identity) || '').includes(s.unique));
    const ok = hasOwn && !leaked;
    if (!ok) pass = false;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(6)} expected~[${s.expect.join(', ')}]` +
      `${leaked ? '  <-- "' + s.unique + '" leaked to another speaker!' : ''}\n` +
      `        got: "${got || '(nothing transcribed)'}"`
    );
  }

  // Structural attribution check: every persisted line's userId must be
  // one of our known participants, and roomId must match -- this is the
  // actual thing W5's guardrail cares about, not just word content.
  const badAttribution = recorded.filter(
    (l) => l.roomId !== ROOM || !participants.some((p) => p.user_id === l.userId)
  );
  if (badAttribution.length > 0) {
    pass = false;
    console.log(`FAIL  ${badAttribution.length} line(s) attributed to an unknown user_id or wrong room:`, badAttribution);
  }

  console.log(`\nOVERALL: ${pass ? 'PASS — real LiveKit+AssemblyAI pipeline attributes correctly end-to-end' : 'FAIL'}`);

  console.log('\n──────── LATENCY (rough) ────────');
  for (const s of SPEAKERS) {
    const first = firstAt.get(s.identity);
    const last = lastAt.get(s.identity);
    if (!first) { console.log(`  ${s.name}: no transcript`); continue; }
    console.log(
      `  ${s.name.padEnd(6)} first caption ~${((first - speakingStartedAt) / 1000).toFixed(1)}s ` +
      `after speaking began · final line ~${((last - speakingDoneAt) / 1000).toFixed(1)}s after audio ended`
    );
  }
  console.log('');

  for (const b of bots) await b.close();
  await stopTranscriptionForRoom(ROOM);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
