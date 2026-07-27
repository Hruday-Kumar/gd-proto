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
    expect(url).toContain('key=test-key');
    expect(JSON.parse(options.body).contents[0].parts[0].text).toMatch(/education/i);
  });

  it('uses an overridden model when GEMINI_MODEL-equivalent option is passed', async () => {
    const fetchImpl = fakeFetchOk('Topic text');
    await generateTopic({}, { apiKey: 'test-key', model: 'gemini-custom-model', fetchImpl });
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain('gemini-custom-model');
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    await expect(generateTopic({}, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/429/);
  });
});

// W6: unlike generateTopic, this takes an already-built prompt string
// (domain/feedbackGeneration.js builds it per student) rather than
// structured filters -- it's the raw `generate(prompt)` shape the
// orchestrator calls directly.
describe('generateFeedback', () => {
  const prompt = 'Write feedback only for Asha based on this transcript...';

  it('throws when no API key is configured', async () => {
    await expect(generateFeedback(prompt, { apiKey: undefined, fetchImpl: fakeFetchOk('x') })).rejects.toThrow(
      /GEMINI_API_KEY/
    );
  });

  it('calls the configured model endpoint with the given prompt and returns the parsed text', async () => {
    const fetchImpl = fakeFetchOk('You stayed on topic and let others speak.');
    const result = await generateFeedback(prompt, { apiKey: 'test-key', fetchImpl });
    expect(result).toBe('You stayed on topic and let others speak.');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain(DEFAULT_GEMINI_MODEL);
    expect(JSON.parse(options.body).contents[0].parts[0].text).toBe(prompt);
  });

  it('throws a descriptive error when the API responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    await expect(generateFeedback(prompt, { apiKey: 'test-key', fetchImpl })).rejects.toThrow(/500/);
  });
});
