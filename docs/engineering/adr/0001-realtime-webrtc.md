# ADR-0001: Real-time room / WebRTC provider

**Status:** Accepted
**Date:** 2026-07-25
**Category:** Real-time room/WebRTC (see `METHOD.md` for rubric)

**Budget re-check (2026-07-25):** re-verified against the tightened
zero-out-of-pocket bar (see ADR-0004/`METHOD.md`) — **still holds.** LiveKit
Cloud's Build tier is genuinely free forever, no credit card required to
sign up or to stay on it [[10]](https://livekit.com/pricing.md). One minor
operational note found on re-check, not a decision-changer: agents on the
Build tier can idle-shutdown between sessions, causing a 10–20s cold start
on the next one — worth knowing for the Phase 1 build, not a blocker now.

## Context
GD Arena Multiplayer needs a live audio room where every participant's mic
audio is available to the server as a **separate stream**, so each line of
transcript can be attributed to the right speaker without diarization
guesswork (a hard product requirement — see `PlaceMe_Product_Context_v2.md`
and guardrail #1's attribution-verification gate). Per guardrail #5, this ADR
is written only after the Phase 0a spike (`SPIKE_PLAN.md`) validated that
assumption end-to-end, automated and human-confirmed, on **LiveKit Cloud**.
This ADR checks LiveKit against current alternatives before finalizing it,
per guardrail #6 (live-sourced, cited) and #7 (mainstream/maintainable only).

Team is new to WebRTC entirely (`TEAM.md`), so "managed, hides the hard part"
is weighted heavily. Budget is <~$100/mo; scale is ~5–10 concurrent rooms at
launch, ~20–30 at 3 months (tiny pilot).

## Options considered

| Provider | Live per-speaker server access | Managed/beginner fit | Mainstream & actively maintained | Cost at pilot scale | Lock-in / self-host escape | 
|---|---|---|---|---|---|
| **LiveKit Cloud** ✅ chosen | ✅ **Agents framework**: server-side bot subscribes to each participant's live track individually — exactly what we spiked and validated with Deepgram | ✅ Purpose-built for this (join room as bot, get per-participant audio frames in real time) | ✅ Large, fast-growing OSS community; extensive docs/tutorials | ✅ Free "Build" tier: 5,000 WebRTC min + 1,000 agent min/mo, 50GB egress, no card. Paid "Ship" $50/mo if outgrown — still under budget. [[1]](https://www.usagepricing.com/blueprint/livekit) | ✅ **Best in class** — LiveKit Server core is Apache-2.0 OSS, self-hostable later if needed |
| Daily.co | ⚠️ "Raw-tracks" recording captures each participant's track as a separate file (to S3), but it's a recording feature, not a live-subscribe-and-stream primitive for a server-side bot | ✅ Good docs, easy API | ✅ Mainstream, active (raw-tracks revamped May 2026) [[2]](https://www.daily.co/blog/recording-improvements-next-gen-raw-tracks-and-new-compositor-with-layout-animations/) | ✅ Free tier: 10,000 min/mo, then ~$0.004/participant-min sliding down [[3]](https://www.daily.co/blog/pricing-our-video-calling-api/) | ❌ Fully proprietary/closed, no self-host path |
| Agora | ⚠️ Cloud Recording "individual mode" records each UID's audio as separate files (M3U8/TS), again recording-oriented rather than a live in-room bot API [[4]](https://docs.agora.io/en/cloud-recording/develop/individual-mode) | ⚠️ More low-level/enterprise-flavored SDK; steeper ramp for a first-time team | ✅ Mainstream, huge scale, actively maintained | ✅ 10,000 free min/mo shared bucket, then ~$0.99/1k audio-min — cheapest at scale [[5]](https://docs.agora.io/en/voice-calling/reference/billing-policies) | ❌ Fully proprietary/closed |
| Amazon Chime SDK | ⚠️ Possible via media pipelines/capture but far less documented for a "live bot subscribes per participant" pattern than LiveKit | ⚠️ Powerful but AWS-ecosystem-first; thinner beginner tutorial base outside AWS docs | ⚠️ Maintained, but noticeably smaller community/tutorial footprint than LiveKit/Daily/Agora | ✅ Pure pay-as-you-go, no free tier bucket but cheap at this scale [[6]](https://aws.amazon.com/chime/chime-sdk/pricing/) | ❌ Proprietary, tied to AWS |
| Twilio Programmable Video | — | — | ❌ **Ruled out** — product is in end-of-life/sunset status; Twilio is steering customers to Zoom Video SDK instead of building new dependencies on it [[7]](https://bloggeek.me/twilio-programmable-video-sunset/) | — | — |
| Vonage Video API (OpenTok) | ⚠️ Not evaluated in depth — screened out earlier on ecosystem fit | ⚠️ Still maintained (v2.34.0 shipped May 2026) [[8]](https://tokbox.com/developer/sdks/js/release-notes.html) but smaller community/tutorial base, more enterprise-dashboard-first UX | ⚠️ Maintained but smaller mainstream footprint | not evaluated | ❌ Proprietary |
| Self-hosted SFU (Jitsi / mediasoup / Janus) | ✅ Full control | ❌ **Disqualified immediately** — this is precisely the "hard, unfamiliar part" TEAM.md says to keep managed; self-operating an SFU is out of scope for a team new to WebRTC | n/a | Free-ish (server cost only) but ops cost is the real cost | ✅ No lock-in, but wrong tradeoff for this team |
| 8x8 Jitsi as a Service (managed Jitsi) | ⚠️ Managed, but per-participant live track APIs for a custom STT pipeline are less flexible/documented than LiveKit Agents | ✅ Managed | ⚠️ Smaller ecosystem/example base for this specific use case | ✅ 25 MAU free dev tier, then $0.35/MAU sliding down [[9]](https://cpaas.8x8.com/en/pricing/jitsi-as-a-service-pricing/) | ⚠️ Jitsi core is OSS, but JaaS-specific features aren't portable 1:1 to self-host | 

## Decision
**LiveKit Cloud**, using the **LiveKit Agents** framework for server-side
per-participant audio subscription (already built and validated in the Phase
0a spike — see `SPIKE_PLAN.md`).

Reasoning, in plain terms: every proprietary competitor (Daily, Agora, Chime,
Vonage) can get us *a* recording of each speaker, but usually as a file
produced during/after the call — not a live "join the room as a bot and read
each person's audio in real time" primitive. LiveKit Agents is built
specifically for that pattern, which is exactly what per-speaker live
transcription needs. LiveKit is also the only option whose core server is
open source (Apache-2.0) — if we ever outgrow the hosted free/paid tiers or
need to move off it, self-hosting the same software is a real option, not a
full rewrite. Combined with the fact that it's the only option we've actually
run with real students, it's the clear choice.

## Consequences
- **Positive:** Zero new integration work — spike code is production-shaped
  already. Free at current and 3-month pilot scale (5,000 WebRTC min +
  1,000 agent min/mo); $50/mo "Ship" tier has headroom under the $100/mo
  budget if usage grows past that. Self-host escape hatch keeps us
  cloud-agnostic per the fixed constraints.
- **Risk to track:** LiveKit Agents (Node/Python) is a specific framework —
  our STT-pipeline code is written against its API shape. Mitigated by the
  OSS core (a self-hosted LiveKit Server is still the same API).
  Metered charges beyond the free tier (agent-minutes, egress, data transfer)
  need light monitoring as room count grows toward the 20–30 room/3-month
  mark — not a blocker now, just a watch item.
- **Coupling note for the next ADR:** LiveKit Agents' live per-track
  subscription is *why* Deepgram was easy to wire up server-side in the
  spike. The STT ADR (next session) should still compare Deepgram against
  alternatives on its own merits, but should note this integration ease as
  one of Deepgram's spike-evidenced advantages, not assume it's the only STT
  that works with LiveKit.

## Revisit if
- LiveKit Cloud pricing or free-tier terms change materially, or
- We exceed ~5,000 WebRTC minutes/mo consistently (re-check Ship tier vs.
  self-hosting the OSS core), or
- A future module (e.g. GD AI Voice Practice) needs capabilities LiveKit
  can't provide.

## Sources
1. [LiveKit Pricing — UsagePricing](https://www.usagepricing.com/blueprint/livekit)
2. [Daily raw-tracks recording revamp, May 2026](https://www.daily.co/blog/recording-improvements-next-gen-raw-tracks-and-new-compositor-with-layout-animations/)
3. [Daily pricing model](https://www.daily.co/blog/pricing-our-video-calling-api/)
4. [Agora Cloud Recording — individual mode](https://docs.agora.io/en/cloud-recording/develop/individual-mode)
5. [Agora Voice Calling billing policies](https://docs.agora.io/en/voice-calling/reference/billing-policies)
6. [Amazon Chime SDK pricing](https://aws.amazon.com/chime/chime-sdk/pricing/)
7. [Twilio Programmable Video sunset — BlogGeek.me](https://bloggeek.me/twilio-programmable-video-sunset/)
8. [Vonage/OpenTok JS SDK release notes](https://tokbox.com/developer/sdks/js/release-notes.html)
9. [8x8 Jitsi as a Service pricing](https://cpaas.8x8.com/en/pricing/jitsi-as-a-service-pricing/)
10. [LiveKit Cloud pricing — no credit card required, 2026 re-check](https://livekit.com/pricing.md)
