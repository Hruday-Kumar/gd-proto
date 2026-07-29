# ADR-0002: Live speech-to-text (STT) provider

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Live speech-to-text (see `METHOD.md` for rubric)

**Budget re-check (2026-07-25):** re-verified against the tightened
zero-out-of-pocket bar (see ADR-0004/`METHOD.md`) — **this is the one
category so far where a truly free-forever option doesn't realistically
exist.** Recorded here in full rather than silently patched over:
- AssemblyAI: no card required to sign up, but the free plan is a
  **one-time $50 credit** (~333 hours of streaming), not a recurring
  monthly allowance. Once spent, continued use requires adding a payment
  method and paying pay-as-you-go [[11]](https://costbench.com/software/ai-transcription-apis/assemblyai/free-plan/).
- Deepgram (the fallback option) is the same shape: a one-time $200 credit,
  no card required to start, card required once it runs out [[12]](https://costbench.com/software/ai-transcription-apis/deepgram/discounts/).
- The one genuinely $0-forever, no-card, open-technology option — the
  browser's built-in Web Speech API — **was already tried and rejected on
  the merits**, not on cost: Phase 0a's Stage 1 spike found it unreliable in
  practice (a solo 3-tab run produced no captions at all), which is exactly
  why the project moved to server-side STT in the first place (see
  `SPIKE_PLAN.md`). Re-raising it here would mean shipping a feature we
  already have evidence doesn't work.
- Self-hosting an open-source model (Whisper) doesn't actually clear the
  zero-budget bar either: real-time multi-stream transcription needs a
  server (realistically a GPU one to keep latency acceptable), which is
  *ongoing rental cost*, not a one-time thing — plausibly more expensive
  than the metered API bill it replaces, on top of the operational
  complexity already ruled out below in "Options considered."

**Conclusion:** live STT has an unavoidable small usage-based cost once
trial credit runs out, at any viable provider. At realistic pilot volumes
this is genuinely small — order of $10–30/month, not $100s (see the Decision
section's cost comparison) — and comfortably inside the project's overall
<$100/mo ceiling. This is flagged as the category where, if/when trial
credit is exhausted, a small real card-based spend is the honest answer
rather than a free workaround — treat it as the last-resort case, not the
default assumption for the remaining categories.

## Context
Our architecture (validated in the Phase 0a spike, `SPIKE_PLAN.md`) opens
**one streaming STT connection per speaker**, not one per room — that's what
makes attribution structural instead of relying on diarization. That
architectural fact matters for this ADR specifically: the thing that scales
with our pilot targets isn't "10 rooms," it's "10 rooms × participants per
room" simultaneous open streaming connections. At launch (~5–10 concurrent
rooms) and 3 months (~20–30 concurrent rooms), assuming a typical GD group of
~5 people, that's roughly **25–50 simultaneous streams at launch and
100–150 at 3 months** in the worst case (all rooms active at once). Any
provider's *concurrency* ceiling — not just its per-minute price — is
therefore a real constraint for this category, on top of the usual
mainstream/managed/cost checks.

Deepgram enters as the evidence-backed incumbent: it's what the spike used,
end-to-end validated with real humans. This ADR checks it against current
(2026) alternatives per guardrail #6/#7 before finalizing.

## Options considered

| Provider | Streaming API fit | Cost (streaming) | Concurrency @ our scale | Mainstream/docs | Lock-in |
|---|---|---|---|---|---|
| **AssemblyAI Universal-Streaming** ✅ chosen | ✅ Standard per-connection WS streaming, same shape as our spike code | ✅ **$0.15/hr ≈ $0.0025/min** flat, all languages [[1]](https://www.assemblyai.com/universal-streaming) | ✅ **No hard concurrency ceiling** — PAYG starts at 100 *new* sessions/min and auto-scales up with usage, no sales call needed [[2]](https://www.assemblyai.com/docs/concepts/concurrency-limit) | ✅ Mainstream, actively developed (multilingual streaming shipped 2026), strong docs | ✅ Proprietary SaaS, same category of vendor dependency as Deepgram — no worse |
| Deepgram Nova-3 (spike-validated) | ✅ Already built, working, human-confirmed | ⚠️ ~$0.0048–0.0077/min depending on tier — 2–3x AssemblyAI's rate [[3]](https://convertaudiototext.com/blog/deepgram-nova-3-explained) | ❌ **PAYG default cap: 50 concurrent WebSocket streams, not self-serve-increasable** — contact sales required to raise it [[4]](https://developers.deepgram.com/docs/working-with-concurrency-rate-limits) — right at our *launch* ceiling and ~3x under our 3-month worst case | ✅ Mainstream, strong docs, already proven in this project | ✅ Same category as AssemblyAI |
| Google Cloud Speech-to-Text v2 | ✅ Streaming supported | ⚠️ $0.016/min, 60 free min/mo [[5]](https://cloud.google.com/speech-to-text/pricing) | not evaluated in depth (screened out on cost + ecosystem fit before digging further) | ⚠️ Mainstream but GCP-first; heavier setup (service accounts, IAM) for a first-time team | ❌ Pulls in GCP account/IAM as a dependency |
| Azure AI Speech | ✅ Streaming supported | ⚠️ $1/hr ($0.0167/min), 5 free hrs/mo [[6]](https://blocksentient.com/review/microsoft-azure-speech-service/) | not evaluated in depth | ⚠️ Mainstream but pulls in the Azure ecosystem | ❌ Azure-account dependency |
| AWS Transcribe (streaming) | ✅ Streaming supported | ❌ $0.024/min tier 1 (most expensive of the group), 60 free min for 12 months only [[7]](https://brasstranscripts.com/blog/aws-transcribe-pricing-per-minute-2025-better-alternative) | not evaluated in depth | ⚠️ Mainstream but AWS-first | ❌ AWS-account dependency |
| OpenAI gpt-4o-transcribe / realtime | ⚠️ Real-time transcript deltas exist, but the product is tuned for short voice-agent turns, not continuous multi-minute meeting-style streams per speaker [[8]](https://tokenmix.ai/blog/gpt-4o-transcribe-speech-to-text-api-guide-2026) | ✅ $0.006–0.017/min depending on model | ❌ Not documented for our use pattern (many long-lived parallel streams); immature for this compared to purpose-built STT vendors | ⚠️ Newer for this specific use case | — |
| Speechmatics | ✅ Streaming supported, competitive accuracy (10% WER, best of the group in one benchmark) [[9]](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/) | ⚠️ $0.0067–0.0117/min Pro tier | ❌ **Free tier capped at 2 concurrent real-time sessions** [[10]](https://smallest.ai/blog/speech-to-text-api-pricing-models-explained-(2026)); scaling concurrency "usually requires plan upgrades or custom contracts" — same sales-call ceiling problem as Deepgram, worse at the free tier | ⚠️ Smaller, more enterprise-contract-oriented | — |
| Self-hosted Whisper | ✅ Full control, $0 marginal cost | Infra cost only, but real (GPU instance) | Scaling is entirely our problem | ❌ **Disqualified immediately** — running and scaling our own real-time multi-stream ASR inference is exactly the unmanaged "hard part" TEAM.md says to avoid for a team new to this domain | ✅ No vendor lock-in, but wrong tradeoff here |

## Decision
**AssemblyAI Universal-Streaming**, replacing Deepgram as the STT provider
for the real build.

This is a genuine pivot away from the spike's validated choice, so the
reasoning needs to be explicit:
- **Concurrency is the deciding factor.** Our per-speaker-connection
  architecture means simultaneous open streams scale with (rooms ×
  participants), not room count. Deepgram's default pay-as-you-go cap is 50
  concurrent WebSocket streams — that's already at our *launch* ceiling and
  roughly 3x under our 3-month target (~100–150 worst case), and raising it
  requires a sales conversation, not a self-serve upgrade. AssemblyAI's
  pay-as-you-go concurrency auto-scales with usage with no hard ceiling,
  which is a structurally better fit for how our product actually uses
  streaming STT.
- **It's also cheaper** (~$0.0025/min vs. ~$0.0048–0.0077/min) and benchmarks
  competitively or better on accuracy in independent testing — not the
  primary driver, but not a downside either.
- **Switching cost is low.** Per `LESSONS.md`, our Deepgram integration
  already bypasses their SDK and talks to the raw streaming WebSocket API
  directly — AssemblyAI's streaming API is the same shape (open a WS
  connection per speaker, get transcript events back). This isn't a
  rewrite, it's swapping one WebSocket endpoint/message-format for another
  in the transcriber module.
- Deepgram remains a fully credible fallback — it's real, human-validated,
  working code today — this decision is about which vendor to build the real
  product against, not a judgment that Deepgram is broken.

## Consequences
- **Positive:** Removes a concrete scaling risk (Deepgram's concurrency cap)
  before it becomes a live-room failure in front of real students — which
  guardrail #1 treats as a serious class of bug. Lower cost. Comparable or
  better accuracy per current benchmarks.
- **Risk / cost of the pivot:** The Phase 0a spike's human-verification gate
  (guardrail #1) was run against Deepgram, not AssemblyAI. Before Phase 1
  build work leans on AssemblyAI for real rooms, we should re-run a small
  smoke test (reuse `selftest.js`'s pattern, swapped to AssemblyAI's
  streaming endpoint) to reconfirm attribution and finalization latency hold
  — this is a light validation step, not a full new spike, since the
  room/attribution architecture itself (LiveKit Agents, one connection per
  track) is unchanged and already proven.
- Deepgram's $200 free credit becomes unused for production; it's harmless
  to keep the key around as a backup path if AssemblyAI has an outage.
- **Payment decision — RESOLVED (user decision, 2026-07-29, superseding the
  2026-07-25 deferral below):** when the current $50 trial credit runs out,
  **open a fresh AssemblyAI trial account** rather than adding a card —
  stays card-free longer, consistent with the project's zero-out-of-pocket
  bar (`budget-zero-out-of-pocket`). Trade-off accepted explicitly: this
  adds account-rotation overhead (new API key, update `.env` + Render's
  `ASSEMBLYAI_API_KEY`) and isn't infinitely repeatable if AssemblyAI
  tightens trial eligibility — revisit if that becomes a recurring hassle
  or trials stop being available.
- ~~**Payment decision explicitly deferred (user decision, 2026-07-25):**
  run on AssemblyAI's current $50 trial credit as-is for now. When it runs
  out, the choice between adding a card vs. opening a fresh free-tier
  account for another trial period is a build-phase decision to make at
  that time, not now — noted here so it isn't forgotten, not resolved in
  this ADR.~~ (Resolved above, 2026-07-29.)

## Revisit if
- The AssemblyAI smoke test above surfaces an accuracy/latency regression
  vs. what we saw with Deepgram, or
- AssemblyAI's pricing or concurrency-scaling policy changes materially, or
- Actual usage patterns turn out much lower than worst-case (all rooms
  simultaneously active) and Deepgram's 50-stream cap stops being a binding
  constraint — worth a cost re-check at that point, not a blocker now.

## Sources
1. [AssemblyAI Universal-Streaming](https://www.assemblyai.com/universal-streaming)
2. [AssemblyAI concurrency limits](https://www.assemblyai.com/docs/concepts/concurrency-limit)
3. [Deepgram Nova-3 pricing](https://convertaudiototext.com/blog/deepgram-nova-3-explained)
4. [Deepgram concurrency/rate limits](https://developers.deepgram.com/docs/working-with-concurrency-rate-limits)
5. [Google Cloud Speech-to-Text pricing](https://cloud.google.com/speech-to-text/pricing)
6. [Azure AI Speech pricing review](https://blocksentient.com/review/microsoft-azure-speech-service/)
7. [AWS Transcribe pricing](https://brasstranscripts.com/blog/aws-transcribe-pricing-per-minute-2025-better-alternative)
8. [gpt-4o-transcribe pricing/guide](https://tokenmix.ai/blog/gpt-4o-transcribe-speech-to-text-api-guide-2026)
9. [Independent STT benchmarks — Coval](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)
10. [Speechmatics pricing model](https://smallest.ai/blog/speech-to-text-api-pricing-models-explained-(2026))
11. [AssemblyAI free plan — one-time $50 credit, 2026](https://costbench.com/software/ai-transcription-apis/assemblyai/free-plan/)
12. [Deepgram $200 credit terms, 2026](https://costbench.com/software/ai-transcription-apis/deepgram/discounts/)
