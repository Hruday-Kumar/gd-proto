// The testable core of the Gemini topic wrapper (W4, peripheral per
// PHASE1_PLAN.md §5, but the prompt-building/response-parsing is pure and
// cheap to test in isolation from the actual network call).
import { describe, it, expect } from 'vitest';
import { buildTopicPrompt, parseTopicResponse } from '../src/domain/topicPrompt.js';

describe('buildTopicPrompt', () => {
  it('produces a base prompt asking for a single GD topic when no filters given', () => {
    const prompt = buildTopicPrompt();
    expect(prompt).toMatch(/group discussion/i);
    expect(prompt).toMatch(/one sentence|single topic/i);
  });

  it('includes category and difficulty when provided', () => {
    const prompt = buildTopicPrompt({ category: 'technology', difficulty: 'easy' });
    expect(prompt).toMatch(/technology/i);
    expect(prompt).toMatch(/easy/i);
  });
});

describe('parseTopicResponse', () => {
  it('extracts and trims the topic text from a well-formed Gemini response', () => {
    const body = { candidates: [{ content: { parts: [{ text: '  Should social media be regulated?  \n' }] } }] };
    expect(parseTopicResponse(body)).toBe('Should social media be regulated?');
  });

  it('throws when the response has no candidate text', () => {
    expect(() => parseTopicResponse({ candidates: [] })).toThrow(/topic text/i);
    expect(() => parseTopicResponse({})).toThrow(/topic text/i);
  });

  it('throws when the candidate text is blank', () => {
    const body = { candidates: [{ content: { parts: [{ text: '   ' }] } }] };
    expect(() => parseTopicResponse(body)).toThrow(/topic text/i);
  });
});
