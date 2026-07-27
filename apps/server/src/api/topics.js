import { Router } from 'express';
import { generateTopic } from '../llm/geminiClient.js';

// W4: custom topic entry + Gemini-generated topics. Custom topics are
// attributed to the student who entered them; generated topics have no
// creator (source: 'llm', created_by null -- see the 0003 migration).
export function createTopicsRouter(requireAuth, { insertCustomTopic, insertGeneratedTopic, generateTopicFn = generateTopic }) {
  const router = Router();

  router.post('/api/topics/custom', requireAuth, async (req, res) => {
    const { text, category, difficulty } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    const topic = await insertCustomTopic(req.userId, { text: text.trim(), category, difficulty });
    res.status(201).json(topic);
  });

  router.post('/api/topics/generate', requireAuth, async (req, res) => {
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
