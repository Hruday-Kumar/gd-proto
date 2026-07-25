# ADR-0008: LLM provider

**Status:** Accepted
**Date:** 2026-07-25
**Category:** LLM provider (see `METHOD.md` for rubric — last of the 8
Phase 0b categories)

## Context
Two distinct LLM uses in v1, with two different risk profiles:
1. **GD topic generation** — student picks a category/difficulty, the LLM
   returns a discussion topic. **No personal data involved at all.**
2. **Individual written feedback** (`PlaceMe_Product_Context_v2.md`) — the
   LLM reads a student's own transcript and writes their feedback
   paragraph. **This does involve personal data** — a student's own speech,
   attributed to them.

That distinction matters directly for this ADR, because (as found below)
the cheapest option's free tier and its data-privacy terms are linked.

## Options considered

| Provider | Genuinely free tier, no card? | Rate limits at our scale | Longevity | Data-use note |
|---|---|---|---|---|
| **Google Gemini API (AI Studio)** ✅ chosen | ✅ **The only major provider with a true indefinite free API tier** — no card, no expiry [[1]](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-complete-guide) | ✅ Generous for our volume — e.g. Gemini 2.5 Flash: up to 250–1,500 requests/day, 1M tokens/min, 1M-token context [[2]](https://tokenmix.ai/blog/gemini-api-free-tier-limits) | ✅ Backed by Google — large, stable, unlikely to disappear | ⚠️ **Free tier: Google may use prompts/responses to improve its products; human reviewers may see them.** Paid tier: explicitly not used for training [[3]](https://docs.bswen.com/blog/2026-03-23-gemini-free-tier-data-privacy/) — see Decision below for how this splits across our two use cases |
| OpenAI API | ❌ **No permanent free tier at all** — every call is paid; only a small, inconsistent one-time trial credit exists, and even that needs a card on file [[4]](https://tokenmix.ai/blog/openai-api-no-credit-card) | — | ✅ Backed by Microsoft/large investment | — |
| Anthropic Claude API | ❌ Same shape as OpenAI — no permanent free API tier, one-time ~$5 credit only (phone verification, and a card is standard for continued use) [[5]](https://pricepertoken.com/endpoints/anthropic/free) | — | ✅ Well-funded, major backers | — |
| Groq | ✅ No card, 14,400 requests/day [[6]](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb) | ⚠️ Request count is generous but token throughput is capped at 6,000 tokens/min — tight for longer feedback paragraphs | ⚠️ Smaller, more specialized company than Google/Microsoft-backed rivals; free tier explicitly described as "for testing/prototyping, not production" in current sources | — |
| OpenRouter (`:free` models) | ✅ No card, real models from multiple providers at $0 [[7]](https://www.teamday.ai/blog/best-free-ai-models-openrouter-2026) | ❌ Only **50 requests/day** by default — plausibly too tight even at our small pilot scale (topic + feedback requests across 5–10 rooms/day can exceed that) unless we spend $10 once to raise it to 1,000/day, which is a one-time real cost | ⚠️ Aggregator depending on many third-party model providers — less predictable/consistent than one primary vendor | Varies per underlying model/provider |

## Decision
**Google Gemini API**, via Google AI Studio's free tier — but **split by
use case**, because the free tier's data-use terms interact differently
with each:

- **Topic generation → free tier, no reservation.** No personal data is
  ever sent, so "Google may use this to improve its products" carries no
  student-privacy weight here. This is a clean, permanent $0 use of the
  free tier.
- **Feedback generation → flagged as a build-phase decision, not resolved
  in this ADR.** This call sends a student's own transcript to the LLM.
  Doing that on a tier whose terms say prompts "may be used to improve
  Google's products" and "human reviewers may see it" is a real,
  additional data-sharing question on top of the mic/audio consent
  guardrail #3 already requires — reviewing a paragraph of AI-analysis of
  a specific student's speech is a different thing than a company
  reviewing an anonymous prompt. Two honest paths forward, both viable, and
  worth the user's input rather than a unilateral pick:
  1. **Stay on the free tier**, but extend the existing recorded-consent
     flow to explicitly disclose that session transcripts are processed by
     Google's Gemini API under its free-tier terms — genuinely $0, but a
     real disclosure to write carefully and get right.
     Alternatively, use Gemini's paid tier (Google's terms make clear
     paid-tier prompts are **not** used for training [[3]](https://docs.bswen.com/blog/2026-03-23-gemini-free-tier-data-privacy/))
     — a small, real cost break from the zero-out-of-pocket rule, but
     Gemini Flash-tier pricing is cheap enough that feedback generation at
     pilot volume (dozens to low hundreds of sessions/week) would likely
     run a few dollars a month, not a real budget threat, and it sidesteps
     the disclosure question entirely with a cleaner privacy story.
  2. This is this project's second flagged "small real spend may be the
     honest answer" case (after STT in ADR-0002) — per the user's standing
     guidance, treat it as the last-resort option, decide when Phase 1
     actually builds the feedback feature, not now.

Groq and OpenRouter remain credible, genuinely free fallbacks if Gemini's
free-tier limits are ever a problem for the *topic generation* path
specifically (no personal-data concern there either way) — noted, not
adopted, since Gemini alone already comfortably covers our scale.

**Feedback-generation decision made (user, 2026-07-25):** stay on Gemini's
**free tier** for feedback generation too, matching topic generation, with
the explicit intent to move that one call to the paid tier later once
there's budget. This is path 1 from the two options above — **the
consent-flow disclosure is therefore a required Phase 1 task, not
optional:** before feedback generation ships, the recorded-consent flow
(guardrail #3) must be extended to disclose that session transcripts are
processed by Google's Gemini API under its free-tier terms (prompts may be
used to improve Google's products; human reviewers may see them). Shipping
feedback generation without that disclosure update would violate the
"explicit recorded consent" guardrail, not just be an oversight.

**Implementation note:** this ADR's research (2026-07-25) found the
current free-tier model lineup to be the Gemini **2.5** family (Flash,
Flash-Lite, Pro) — Gemini 2.5 Flash had the most generous free daily/RPM
limits of the three. Whoever implements this should confirm the exact
model/limits at build time rather than assuming a specific version number,
since this moves quickly; the provider decision (Gemini/Google AI Studio)
is what this ADR fixes, not a specific model snapshot.

## Consequences
- **Positive:** Topic generation is unambiguously solved — free forever, no
  card, no compliance wrinkle, generous limits. Google's scale gives this
  the strongest longevity footing of the free options.
- **Decided, with a required follow-up task (2026-07-25):** feedback
  generation stays on the free tier, matching topic generation, with a
  planned move to the paid tier once there's budget. The required
  follow-up is not optional: the consent flow must disclose free-tier
  processing before this feature ships (see above) — this is exactly the
  kind of "human verification gate" territory guardrail #1 cares about,
  since feedback text is the thing students actually read and trust.
- No new vendor lock-in risk beyond the usual "any LLM API is swappable
  with a rewrite of the prompt-calling code" — this isn't a foundational
  platform choice like hosting/auth/database, so switching providers later
  if needed is a comparatively small, isolated change.

## Revisit if
- There's budget to move feedback generation to the paid tier, per the
  user's stated intent to revisit this later — at that point, update this
  ADR's status to reflect the switch and confirm the consent copy is
  updated too (disclosure no longer applies once off the free tier).
- Gemini's free-tier terms or limits change materially, or
- Actual usage approaches the free-tier daily/per-minute caps — Groq or
  OpenRouter's free models are the first fallback to reach for before
  paying for Gemini's own paid tier.

## Sources
1. [Gemini API free tier — indefinite, no card](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-complete-guide)
2. [Gemini API free tier limits 2026](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
3. [Gemini free vs. paid tier data/training use](https://docs.bswen.com/blog/2026-03-23-gemini-free-tier-data-privacy/)
4. [OpenAI API — no permanent free tier](https://tokenmix.ai/blog/openai-api-no-credit-card)
5. [Anthropic API free credits — one-time only](https://pricepertoken.com/endpoints/anthropic/free)
6. [Groq API free tier 2026](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb)
7. [OpenRouter free models 2026](https://www.teamday.ai/blog/best-free-ai-models-openrouter-2026)
