// Gemini client wrapper (W4, peripheral). fetchImpl is injected so this is
// testable without a live API key or network call -- same DI pattern as
// getSupabase()'s callers elsewhere in this codebase.
import { describe, it, expect, vi } from 'vitest';
import {
  generateTopic,
  generateTranscriptAnalysis,
  generateCriterionEvaluation,
  generateEvaluationFeedback,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_EVAL_TEMPERATURE,
} from '../src/llm/geminiClient.js';

function fakeFetchOk(text) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  });
}

describe('generateTopic', () => {
  it('throws when no API key is configured', async () => {
    await expect(generateTopic({}, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('calls the configured model endpoint and returns the parsed topic text', async () => {
    const fetchImpl = fakeFetchOk('Should engineering colleges make internships mandatory?');
    const result = await generateTopic(
      { category: 'education' },
      { apiKey: 'test-key', fetchImpl }
    );
    expect(result).toBe('Should engineering colleges make internships mandatory?');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toMatch(/education/i);
  });

  // N9 (audit comparison, 2026-07-29): the API key used to travel in the
  // URL query string, where it's a classic accidental-disclosure vector
  // (proxy logs, CDN logs, browser history if this were ever a client-side
  // call). Google's API accepts an x-goog-api-key header instead.
  it('sends the API key as a header, never in the URL', async () => {
    const fetchImpl = fakeFetchOk('x');
    await generateTopic({}, { apiKey: 'super-secret-key', fetchImpl });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).not.toContain('super-secret-key');
    expect(options.headers['x-goog-api-key']).toBe('super-secret-key');
  });

  it('uses an overridden model when GEMINI_MODEL-equivalent option is passed', async () => {
    const fetchImpl = fakeFetchOk('Topic text');
    await generateTopic({}, { apiKey: 'test-key', model: 'gemini-custom-model', fetchImpl });
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('gemini-custom-model');
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    await expect(generateTopic({}, { apiKey: 'test-key', fetchImpl, retryAttempts: 1 })).rejects.toThrow(/429/);
  });

  // 2026-07-30 (pilot-readiness + exception-handling pass): no timeout
  // existed anywhere in this file -- a hung Gemini request blocked
  // indefinitely, tying up an HTTP request or a feedback-worker
  // concurrency slot forever.
  it('times out a hung request rather than blocking indefinitely', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              const err = new Error('This operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      const promise = generateTopic({}, { apiKey: 'test-key', fetchImpl, timeoutMs: 15_000, retryAttempts: 1 });
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  // withRetry (domain/retry.js) used to be wired only to the LiveKit
  // connect call -- a transient Gemini 5xx/429 got zero retry.
  it('retries a transient 500 and succeeds on the next attempt', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'Should X be mandatory?' }] } }] }),
      });

    const result = await generateTopic({}, { apiKey: 'test-key', fetchImpl, retryDelayMs: 0 });

    expect(result).toBe('Should X be mandatory?');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  // A 400/401/etc is permanent -- retrying three times only delays
  // surfacing a real problem (a bad/expired key, a malformed request).
  it('does not retry a permanent 4xx failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid key' });

    await expect(generateTopic({}, { apiKey: 'test-key', fetchImpl, retryDelayMs: 0 })).rejects.toThrow(/401/);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

// SPEC-0011 AC9 (chore/eval-cutover-cleanup, 2026-08-04): generateFeedback
// (the old single-shot W6 path) and its tests were removed once AC7's human
// verification passed -- generateEvaluationFeedback below is the only
// feedback-generation call now.

// SPEC-0011 state 2: same raw generate(prompt) shape as the old generateFeedback,
// for the Transcript Analysis stage's evidence-ledger extraction.
describe('generateTranscriptAnalysis', () => {
  const prompt = 'Analyze this transcript, numbered by utterance...';

  function fakeTranscriptAnalysisJsonResponse() {
    return JSON.stringify({
      conversation_understanding: {
        summary: 'Participants discussed remote work tradeoffs.',
        topic_segments: [{ segment_id: 'TS1', description: 'Opening positions.' }],
      },
      evidence_ledger: [
        {
          utterance_indexes: [0],
          evidence_type: 'claim',
          exact_quote: 'remote work improves productivity',
          neutral_description: 'States a position.',
          extraction_confidence: 'high',
        },
      ],
    });
  }

  it('throws when no API key is configured', async () => {
    await expect(
      generateTranscriptAnalysis(prompt, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('calls the configured model endpoint and returns the parsed evidence ledger', async () => {
    const fetchImpl = fakeFetchOk(fakeTranscriptAnalysisJsonResponse());
    const result = await generateTranscriptAnalysis(prompt, { apiKey: 'test-key', fetchImpl });
    expect(result.conversationUnderstanding.summary).toMatch(/remote work tradeoffs/);
    expect(result.evidenceLedger).toHaveLength(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toBe(prompt);
  });

  it('requests Gemini JSON mode with the transcript analysis response schema', async () => {
    const fetchImpl = fakeFetchOk(fakeTranscriptAnalysisJsonResponse());
    await generateTranscriptAnalysis(prompt, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(
      expect.arrayContaining(['conversation_understanding', 'evidence_ledger'])
    );
  });

  it('pins a low, fixed temperature, same as generateFeedback', async () => {
    const fetchImpl = fakeFetchOk(fakeTranscriptAnalysisJsonResponse());
    await generateTranscriptAnalysis(prompt, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body).generationConfig.temperature).toBe(DEFAULT_EVAL_TEMPERATURE);
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(generateTranscriptAnalysis(prompt, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/500/);
  });
});

// SPEC-0011 state 3: same raw generate(prompt) shape, plus a parseContext
// (participant tags / subdimension ids / evidence ids this specific call
// offered) since validating a criterion-evaluation response needs to know
// what was actually offered, unlike the fixed-schema stages above.
describe('generateCriterionEvaluation', () => {
  const prompt = 'Evaluate Clarity for all participants using only this evidence...';
  const parseContext = {
    dimensionLabel: 'Clarity',
    tagToUserId: { P1: 'user-a' },
    evidenceIds: ['E1'],
    subdimensionIds: ['structure', 'word_choice', 'conciseness'],
  };

  function fakeCriterionEvaluationJsonResponse() {
    return JSON.stringify({
      participant_evaluations: [
        {
          participant_tag: 'P1',
          subdimensions: ['structure', 'word_choice', 'conciseness'].map((subdimension_id) => ({
            subdimension_id,
            level: 'demonstrated',
            evidence_ids: ['E1'],
            reasoning: 'Grounded in the cited evidence.',
          })),
        },
      ],
    });
  }

  it('throws when no API key is configured', async () => {
    await expect(
      generateCriterionEvaluation(prompt, parseContext, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('calls the configured model endpoint and returns the parsed per-participant subdimension levels', async () => {
    const fetchImpl = fakeFetchOk(fakeCriterionEvaluationJsonResponse());
    const result = await generateCriterionEvaluation(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    expect(result.dimensionLabel).toBe('Clarity');
    expect(result.participantEvaluations).toHaveLength(1);
    expect(result.participantEvaluations[0].participantUserId).toBe('user-a');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toBe(prompt);
  });

  it('requests Gemini JSON mode with the criterion evaluation response schema', async () => {
    const fetchImpl = fakeFetchOk(fakeCriterionEvaluationJsonResponse());
    await generateCriterionEvaluation(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(['participant_evaluations']);
  });

  it('pins a low, fixed temperature, same as the other evaluation-stage calls', async () => {
    const fetchImpl = fakeFetchOk(fakeCriterionEvaluationJsonResponse());
    await generateCriterionEvaluation(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body).generationConfig.temperature).toBe(DEFAULT_EVAL_TEMPERATURE);
  });

  it('rejects a response citing an evidence_id outside this call\'s parseContext, even though the shape is otherwise valid', async () => {
    const badJson = JSON.parse(fakeCriterionEvaluationJsonResponse());
    badJson.participant_evaluations[0].subdimensions[0].evidence_ids = ['E99'];
    const fetchImpl = fakeFetchOk(JSON.stringify(badJson));
    await expect(generateCriterionEvaluation(prompt, parseContext, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(
      /evidence_id not in the evidence ledger/i
    );
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(generateCriterionEvaluation(prompt, parseContext, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/500/);
  });
});

// SPEC-0011 state 7: the last stage in the pipeline, one call per
// participant, from the already-validated scorecard + this participant's
// own evidence -- same raw generate(prompt, parseContext) shape as
// generateCriterionEvaluation, parseContext here is just the ordered
// dimension label list this call's prompt offered.
describe('generateEvaluationFeedback', () => {
  const prompt = "Write feedback for Asha. Her scores are final, do not restate them differently...";
  const parseContext = { dimensionLabels: ['Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency'] };

  function fakeEvaluationFeedbackJsonResponse() {
    return JSON.stringify({
      summary: 'A constructive summary.',
      dimension_notes: parseContext.dimensionLabels.map((label) => ({ label, note: `Note about ${label}.` })),
      strengths: ['Clear opening.'],
      improvements: ['Invite others in more.'],
    });
  }

  it('throws when no API key is configured', async () => {
    await expect(
      generateEvaluationFeedback(prompt, parseContext, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it('calls the configured model endpoint and returns the parsed feedback text', async () => {
    const fetchImpl = fakeFetchOk(fakeEvaluationFeedbackJsonResponse());
    const result = await generateEvaluationFeedback(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    expect(result.summary).toBe('A constructive summary.');
    expect(result.dimensionNotes).toHaveLength(5);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toBe(prompt);
  });

  it('requests Gemini JSON mode with the evaluation feedback response schema, which has no score field', async () => {
    const fetchImpl = fakeFetchOk(fakeEvaluationFeedbackJsonResponse());
    await generateEvaluationFeedback(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(
      expect.arrayContaining(['summary', 'dimension_notes', 'strengths', 'improvements'])
    );
    expect(JSON.stringify(body.generationConfig.responseSchema).toLowerCase()).not.toMatch(/score/);
  });

  it('pins a low, fixed temperature, same as the other evaluation-stage calls', async () => {
    const fetchImpl = fakeFetchOk(fakeEvaluationFeedbackJsonResponse());
    await generateEvaluationFeedback(prompt, parseContext, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body).generationConfig.temperature).toBe(DEFAULT_EVAL_TEMPERATURE);
  });

  it('rejects a response whose dimension_notes labels do not match this call\'s parseContext order', async () => {
    const badJson = JSON.parse(fakeEvaluationFeedbackJsonResponse());
    badJson.dimension_notes[0].label = 'Made up dimension';
    const fetchImpl = fakeFetchOk(JSON.stringify(badJson));
    await expect(generateEvaluationFeedback(prompt, parseContext, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(
      /unexpected label/i
    );
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(generateEvaluationFeedback(prompt, parseContext, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/500/);
  });
});
