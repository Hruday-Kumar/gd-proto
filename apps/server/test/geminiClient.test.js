// Gemini client wrapper (W4, peripheral). fetchImpl is injected so this is
// testable without a live API key or network call -- same DI pattern as
// getSupabase()'s callers elsewhere in this codebase.
import { describe, it, expect, vi } from 'vitest';
import { generateTopic, generateFeedback, DEFAULT_GEMINI_MODEL } from '../src/llm/geminiClient.js';

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

// W6: unlike generateTopic, this takes an already-built prompt string
// (domain/feedbackGeneration.js builds it per student) rather than
// structured filters -- it's the raw `generate(prompt)` shape the
// orchestrator calls directly.
//
// SPEC-0006 (BE-6/BE-7): feedback is now structured JSON, so the fake
// Gemini response text must itself be a JSON string (parseFeedbackResponse
// parses+validates it), and the request body must carry generationConfig's
// responseMimeType/responseSchema so Gemini's structured-output mode is
// actually requested, not just hoped for via prompt wording.
describe('generateFeedback', () => {
  const prompt = 'Write feedback only for Asha based on this transcript...';

  function fakeFeedbackJsonResponse() {
    return JSON.stringify({
      summary: 'You stayed on topic and let others speak.',
      score: 82,
      dimensions: ['Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency'].map((label) => ({
        label,
        score: 80,
        note: 'Specific note.',
      })),
      strengths: ['Clear opening.'],
      improvements: ['Invite others in more.'],
    });
  }

  it('throws when no API key is configured', async () => {
    await expect(generateFeedback(prompt, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })).rejects.toThrow(
      /GEMINI_API_KEY/
    );
  });

  it('calls the configured model endpoint with the given prompt and returns the parsed structured feedback', async () => {
    const fetchImpl = fakeFetchOk(fakeFeedbackJsonResponse());
    const result = await generateFeedback(prompt, { apiKey: 'test-key', fetchImpl });
    expect(result.summary).toBe('You stayed on topic and let others speak.');
    expect(result.score).toBe(82);
    expect(result.dimensions).toHaveLength(5);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toBe(prompt);
  });

  it('requests Gemini JSON mode with the feedback response schema', async () => {
    const fetchImpl = fakeFetchOk(fakeFeedbackJsonResponse());
    await generateFeedback(prompt, { apiKey: 'test-key', fetchImpl });
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeTruthy();
    expect(body.generationConfig.responseSchema.required).toEqual(
      expect.arrayContaining(['summary', 'score', 'dimensions', 'strengths', 'improvements'])
    );
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(generateFeedback(prompt, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/500/);
  });
});
