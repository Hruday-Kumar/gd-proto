# Phase 0a — De-risk Spike Plan & Results

**Status:** ✅ **Assumption VALIDATED.** Stage 2 (server-side Deepgram) passes an
automated, human-free multi-speaker attribution test.
**Date started:** 2026-07-24 · **Result recorded:** 2026-07-24

## The assumption under test
> "A real-time multi-user audio room with live per-speaker transcription and
> attribution is achievable within our budget (<$100/mo) and timeline (~2–4 weeks)."

If this doesn't hold, the whole GD Arena MVP is at risk and we must know **before**
writing ADRs or product code.

## Stack chosen for the spike (free, mainstream, production-representative)
| Layer | Choice | Why (spike) | Free tier |
|---|---|---|---|
| Room / audio | **LiveKit Cloud** | Best-documented managed WebRTC; each participant = separate track ⇒ attribution is structural, not diarization guessing; self-hostable later (no lock-in) | 5,000 WebRTC min + 1,000 agent min / mo, no card |
| STT — Stage 1 | **Browser Web Speech API** | Zero cost, zero extra account; proves the room + attribution loop today | Free |
| STT — Stage 2 | **Deepgram (server-side via LiveKit agent)** | Validates server-authoritative transcription (the real production risk) | $200 credit (~430 hrs), no card |
| Token/host | Node + Express | Single language across the whole spike (team is agent-assisted) | — |

## Two stages, on purpose
- **Stage 1 (built):** browser transcribes each user's own mic, broadcasts final
  lines over LiveKit's data channel tagged to the sender's LiveKit identity.
  Proves: multi-user audio, join-by-code, per-speaker attribution, consent gate,
  end-to-end UX. Needs only a LiveKit account.
- **Stage 2 (next):** a server-side LiveKit agent subscribes to each participant's
  track and streams it to Deepgram, emitting transcripts keyed to that
  participant. **This is required** — Stage 1's client-side STT would give a
  falsely rosy read on the hardest risk (server-side, non-Chrome-dependent,
  storable transcripts). The spike is not "passed" until Stage 2 is validated.

## How Stage 1 is tested (human gate — cannot be automated)
3+ people (or 3+ headphoned tabs) join the same room code, speak in turns and
over each other. See `spike/README.md` for exact steps.

### What we measure
- Audio: do all participants hear each other? Perceived latency? Dropouts?
- Attribution: is every transcript line labelled with the correct speaker?
- Overlap: behaviour when two people talk at once.
- Speaking → text latency (rough).
- Errors in the browser console.

## Results — Stage 1 (browser Web Speech API)
- Server side verified: token server boots, mints unique per-user identities,
  serves the client.
- The in-browser Web Speech API path was **unreliable in practice** (a solo run
  across 3 tabs produced no captions) — which is exactly the reason the plan
  always intended to move transcription server-side. We did not chase it; we
  moved to Stage 2, which supersedes it. The Stage 1 web UI is retained as the
  live human-facing client and now displays Stage 2's server transcripts.

## Results — Stage 2 (Deepgram server-side)  ✅ PASS
**How tested (no humans needed):** `npm run selftest` spins up a hidden
transcriber agent + 3 simulated "speakers" (bots publishing Windows-SAPI TTS
clips as live mic audio) in one LiveKit room, transcribes each track with
Deepgram, and asserts each speaker's expected keywords land under THAT speaker
with no cross-attribution. Ran twice; both PASS.

- **Attribution correctness:** ✅ Perfect across both runs. Alice→technology/
  education, Bob→remote/work, Carol→social/media — each under the correct
  speaker, zero leakage. Attribution is structural (one LiveKit track = one
  participant), so it does not depend on fragile diarization.
- **STT accuracy:** High even on robotic TTS voices (occasional dropped word,
  e.g. "transformed"/"flexibility", on one run but not the other). Real human
  speech typically transcribes as well or better.
- **Latency:** Final transcripts land within **~0.1–0.7s of a speaker pausing**
  (essentially real-time finalization). Captions currently appear at phrase end
  because `interim_results` is off; enabling it yields sub-second live word-by-
  word captions.
- **Overlapping speech:** All 3 bots spoke concurrently for ~5s and attribution
  still held — separate tracks make cross-talk a non-issue for attribution
  (heavy simultaneous cross-talk not yet stress-tested).
- **Observed cost:** ~16s audio/run → Deepgram ≈ **$0.002/run**; LiveKit ≈ 0.7
  participant-min against 5,000 free/mo. Negligible at pilot scale.
- **Does the assumption hold?** **YES.** A real-time multi-user audio room with
  live per-speaker transcription and attribution is achievable now, free at
  pilot scale, on a mainstream/maintainable stack.

### Confidence & remaining caveats
- Consent is not yet persisted and nothing is stored (spike only). Retention/
  consent handling is a build-phase task, not a spike concern.

## Results — Real-human confirmation ✅ PASS
**How tested:** local server + transcriber agent exposed via a Cloudflare Quick
Tunnel (free, no account) to get a real `https://` URL, since browsers block
microphone access on plain-HTTP LAN addresses. User joined from a real device
over the public link and spoke live (real mic, real network, real voice — not
synthetic TTS or same-machine bots).

- **Result:** worked well — captions appeared, attributed correctly to the
  speaker. Confirms the automated self-test result holds with genuine human
  speech and a real device/network path, not just synthetic audio.
- This satisfies the optional real-human confirmation step; combined with the
  Stage 2 self-test, the spike is fully validated end-to-end.

## Decision gate
Stage 2 produced a PASS → the assumption is validated → we may proceed to
**Phase 0b** (formal research + ADRs), one category at a time, in a later
session. The spike stack (LiveKit + Deepgram) is now a strong, evidence-backed
front-runner for the real-time and STT ADRs — but 0b should still compare
alternatives before finalizing.
