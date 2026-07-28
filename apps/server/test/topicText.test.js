// H5 (engineering audit, 2026-07-28): a custom topic's text is stored
// verbatim and later embedded directly into the Gemini feedback prompt for
// EVERY participant in the room (domain/feedbackPrompt.js), with no length
// bound at all -- a student could submit an arbitrarily long block of text
// designed to break out of the "Topic discussed" framing and inject new
// instructions to the model, affecting every other student's feedback in
// that session, not just their own. A length cap alone doesn't eliminate
// injection risk (that also needs delimiting -- see feedbackPrompt.test.js
// and topicPrompt.test.js), but it bounds how much room an attacker has to
// work with and matches what a genuine one-sentence GD topic looks like.
import { describe, it, expect } from 'vitest';
import { isValidCustomTopicText, MAX_CUSTOM_TOPIC_LENGTH } from '../src/domain/topicText.js';

describe('isValidCustomTopicText', () => {
  it('accepts a normal topic sentence', () => {
    expect(isValidCustomTopicText('Should social media be regulated?')).toBe(true);
  });

  it('rejects an empty or whitespace-only topic', () => {
    expect(isValidCustomTopicText('')).toBe(false);
    expect(isValidCustomTopicText('   ')).toBe(false);
  });

  it(`accepts exactly ${MAX_CUSTOM_TOPIC_LENGTH} characters`, () => {
    expect(isValidCustomTopicText('a'.repeat(MAX_CUSTOM_TOPIC_LENGTH))).toBe(true);
  });

  it(`rejects text over ${MAX_CUSTOM_TOPIC_LENGTH} characters`, () => {
    expect(isValidCustomTopicText('a'.repeat(MAX_CUSTOM_TOPIC_LENGTH + 1))).toBe(false);
  });
});
