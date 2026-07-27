// W6 core unit (PHASE1_PLAN.md §5): orchestrates per-student feedback
// generation. The property that matters most -- a Gemini error for one
// student must not lose the transcript or block the other students'
// feedback -- is exactly the kind of silent-failure bug that's easy to
// introduce with a naive loop, same reasoning as W5's persistAttributedLine.
// `generate` (the network call) is injected, no live Gemini key or network.
import { describe, it, expect, vi } from 'vitest';
import { generateFeedbackForRoom } from '../src/domain/feedbackGeneration.js';

const participants = [
  { userId: 'user-a', displayName: 'Asha' },
  { userId: 'user-b', displayName: 'Bilal' },
  { userId: 'user-c', displayName: 'Chen' },
];

const transcriptLines = [
  { userId: 'user-a', text: 'I think remote work improves productivity.' },
  { userId: 'user-b', text: 'I disagree, collaboration suffers.' },
  { userId: 'user-c', text: 'Both sides have merit.' },
];

describe('generateFeedbackForRoom', () => {
  it('generates feedback for every participant', async () => {
    const generate = vi.fn().mockResolvedValue('Great job staying on topic.');
    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants },
      { generate }
    );
    expect(results).toHaveLength(3);
    expect(generate).toHaveBeenCalledTimes(3);
    for (const r of results) {
      expect(r.status).toBe('ok');
      expect(r.body).toBe('Great job staying on topic.');
    }
  });

  it('calls generate with a prompt scoped to each participant by name', async () => {
    const generate = vi.fn().mockResolvedValue('feedback text');
    await generateFeedbackForRoom({ topic: 'Remote work', transcriptLines, participants }, { generate });
    const prompts = generate.mock.calls.map((call) => call[0]);
    expect(prompts.some((p) => /only for asha/i.test(p))).toBe(true);
    expect(prompts.some((p) => /only for bilal/i.test(p))).toBe(true);
    expect(prompts.some((p) => /only for chen/i.test(p))).toBe(true);
  });

  it('isolates a single student\'s generation failure -- others still succeed', async () => {
    const generate = vi.fn().mockImplementation((prompt) => {
      if (prompt.includes('only for Bilal')) return Promise.reject(new Error('gemini quota exceeded'));
      return Promise.resolve('Solid contribution, stayed on topic.');
    });
    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants },
      { generate }
    );
    expect(results).toHaveLength(3);
    const byUser = Object.fromEntries(results.map((r) => [r.userId, r]));
    expect(byUser['user-a'].status).toBe('ok');
    expect(byUser['user-a'].body).toBe('Solid contribution, stayed on topic.');
    expect(byUser['user-c'].status).toBe('ok');
    expect(byUser['user-b'].status).toBe('error');
    expect(byUser['user-b'].body).toBeUndefined();
    expect(byUser['user-b'].error).toMatch(/quota exceeded/);
  });

  it('never leaks a failed student\'s error into another student\'s result', async () => {
    const generate = vi.fn().mockImplementation((prompt) => {
      if (prompt.includes('only for Bilal')) return Promise.reject(new Error('gemini quota exceeded'));
      return Promise.resolve('feedback text');
    });
    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants },
      { generate }
    );
    const byUser = Object.fromEntries(results.map((r) => [r.userId, r]));
    expect(byUser['user-a'].error).toBeUndefined();
    expect(byUser['user-c'].error).toBeUndefined();
  });

  it('does not mutate the transcript lines it was given', async () => {
    const generate = vi.fn().mockResolvedValue('feedback text');
    const original = JSON.parse(JSON.stringify(transcriptLines));
    await generateFeedbackForRoom({ topic: 'Remote work', transcriptLines, participants }, { generate });
    expect(transcriptLines).toEqual(original);
  });
});
