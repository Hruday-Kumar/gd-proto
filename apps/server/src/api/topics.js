import { Router } from 'express';
import { generateTopic } from '../llm/geminiClient.js';
import { createLlmRateLimiter, createRoomActionRateLimiter } from './rateLimit.js';
import { isValidCustomTopicText, MAX_CUSTOM_TOPIC_LENGTH } from '../domain/topicText.js';

// W4: custom topic entry + Gemini-generated topics. Custom topics are
// attributed to the student who entered them; generated topics have no
// creator (source: 'llm', created_by null -- see the 0003 migration).
export function createTopicsRouter(
  requireAuth,
  {
    insertCustomTopic,
    insertGeneratedTopic,
    generateTopicFn = generateTopic,
    llmRateLimiter = createLlmRateLimiter(),
    roomActionRateLimiter = createRoomActionRateLimiter(),
  }
) {
  const router = Router();

  // H4 residual (audit comparison 2026-07-29, N3's recommended fix): this
  // route writes an unbounded row count to `topics` on every request --
  // it doesn't call Gemini itself, so it uses the room-action limiter
  // (api/rateLimit.js), not the LLM one, same reasoning already recorded
  // there for why the two limiters are kept separate.
  router.post('/api/topics/custom', requireAuth, roomActionRateLimiter, async (req, res) => {
    const { text, category, difficulty } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    // H5 (audit 2026-07-28): this text is embedded verbatim into the Gemini
    // feedback prompt for every participant in the room -- bound its length
    // before it's ever stored.
    if (!isValidCustomTopicText(text)) {
      return res.status(400).json({ error: `text must be ${MAX_CUSTOM_TOPIC_LENGTH} characters or fewer` });
    }
    const topic = await insertCustomTopic(req.userId, { text: text.trim(), category, difficulty });
    res.status(201).json(topic);
  });

  // H4 (audit 2026-07-28): rate-limited -- this route calls Gemini directly
  // on every request, no threshold or opt-in involved, unlike /match below.
  router.post('/api/topics/generate', requireAuth, llmRateLimiter, async (req, res) => {
    const { category, difficulty } = req.body || {};
    let text;
    try {
      text = await generateTopicFn({ category, difficulty });
    } catch (err) {
      // A Gemini failure must not look like our own bug -- 502 (bad
      // upstream) rather than a generic 500, and the error is surfaced,
      // not swallowed.
      return res.status(502).json({ error: `Gemini topic generation failed: ${err.message}` });
    }
    const topic = await insertGeneratedTopic({ text, category, difficulty });
    res.status(201).json(topic);
  });

  return router;
}
