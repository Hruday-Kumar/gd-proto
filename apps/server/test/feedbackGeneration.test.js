// W6 core unit (PHASE1_PLAN.md §5): orchestrates per-student feedback
// generation. The property that matters most -- a Gemini error for one
// student must not lose the transcript or block the other students'
// feedback -- is exactly the kind of silent-failure bug that's easy to
// introduce with a naive loop, same reasoning as W5's persistAttributedLine.
// `generate` (the network call) is injected, no live Gemini key or network.
import { describe, it, expect, vi } from 'vitest';
import { generateFeedbackForRoom, DEFAULT_FEEDBACK_CONCURRENCY } from '../src/domain/feedbackGeneration.js';

const participants = [
  { userId: 'user-a', displayName: 'Asha' },
  { userId: 'user-b', displayName: 'Bilal' },
  { userId: 'user-c', displayName: 'Chen' },
];

// A `generate` stub that records the highest number of calls ever in flight
// at the same moment, so a test can assert the fan-out was actually bounded
// rather than just eventually completing.
function concurrencyTrackingGenerate({ resolveWith = 'feedback text' } = {}) {
  let inFlight = 0;
  let peak = 0;
  const generate = vi.fn(async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inFlight -= 1;
    return resolveWith;
  });
  return { generate, getPeak: () => peak };
}

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

  // M11 (audit 2026-07-28): every participant's Gemini call went out in a
  // single Promise.all with no cap -- six at once for a full room, against a
  // free tier with a per-minute request limit. Whoever got rate-limited fell
  // into the existing per-student error path and silently received no
  // feedback at all, which is the one output this whole product exists to
  // deliver. Bounding the fan-out is what stops a full room from tripping the
  // limit in the first place.
  it('never has more than the configured number of Gemini calls in flight at once', async () => {
    const sixParticipants = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => ({ userId: `user-${s}`, displayName: s.toUpperCase() }));
    const { generate, getPeak } = concurrencyTrackingGenerate();

    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants: sixParticipants },
      { generate, concurrency: 2 }
    );

    expect(getPeak()).toBeLessThanOrEqual(2);
    expect(generate).toHaveBeenCalledTimes(6);
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
  });

  it('bounds the fan-out by default, without the caller having to ask', async () => {
    // The worker (agent/feedbackWorker.js) passes no concurrency option, so
    // the default is what actually protects a real room.
    const sixParticipants = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => ({ userId: `user-${s}`, displayName: s.toUpperCase() }));
    const { generate, getPeak } = concurrencyTrackingGenerate();

    await generateFeedbackForRoom({ topic: 'Remote work', transcriptLines, participants: sixParticipants }, { generate });

    expect(DEFAULT_FEEDBACK_CONCURRENCY).toBeLessThan(6);
    expect(getPeak()).toBeLessThanOrEqual(DEFAULT_FEEDBACK_CONCURRENCY);
  });

  it('returns results in participant order regardless of completion order', async () => {
    // Callers (agent/feedbackWorker.js) match results back to students by the
    // userId on each result, but a stable order keeps logs and tests readable
    // and makes the batching invisible to every caller.
    const generate = vi.fn(async (prompt) => {
      // Asha's call finishes last, so completion order != participant order.
      if (prompt.includes('only for Asha')) await new Promise((resolve) => setTimeout(resolve, 20));
      return 'feedback text';
    });

    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants },
      { generate, concurrency: 3 }
    );

    expect(results.map((r) => r.userId)).toEqual(['user-a', 'user-b', 'user-c']);
  });

  it('keeps generating for the remaining students when an early batch fails', async () => {
    // The isolation guarantee has to survive batching: a rejected call must
    // not abort the pool and leave later students with no feedback.
    const { generate: ok } = concurrencyTrackingGenerate();
    const generate = vi.fn(async (prompt) => {
      if (prompt.includes('only for Asha')) throw new Error('gemini quota exceeded');
      return ok(prompt);
    });

    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines, participants },
      { generate, concurrency: 1 }
    );

    const byUser = Object.fromEntries(results.map((r) => [r.userId, r]));
    expect(byUser['user-a'].status).toBe('error');
    expect(byUser['user-b'].status).toBe('ok');
    expect(byUser['user-c'].status).toBe('ok');
  });

  it('does not mutate the transcript lines it was given', async () => {
    const generate = vi.fn().mockResolvedValue('feedback text');
    const original = JSON.parse(JSON.stringify(transcriptLines));
    await generateFeedbackForRoom({ topic: 'Remote work', transcriptLines, participants }, { generate });
    expect(transcriptLines).toEqual(original);
  });

  // Bug fix, 2026-07-27: when transcription fails for a whole room (agent
  // never joined, a network blip, etc.), transcriptLines is empty and the
  // old code still called Gemini with "(no speech was transcribed)" --
  // which the model reasonably read as "this student didn't participate"
  // and said so. That's not true; it's a technical failure, not the
  // student's fault, and must never be presented as feedback on their
  // performance (guardrail #1: feedback must never be discouraging or
  // misleading). An empty transcript must short-circuit before Gemini is
  // ever called, for every participant, every time.
  it('never calls generate and returns an honest technical-issue message when transcriptLines is empty', async () => {
    const generate = vi.fn();
    const results = await generateFeedbackForRoom(
      { topic: 'Remote work', transcriptLines: [], participants },
      { generate }
    );
    expect(generate).not.toHaveBeenCalled();
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe('ok');
      expect(r.body.summary).toMatch(/technical issue/i);
      expect(r.body.summary).not.toMatch(/speak (up|more)|should have (said|spoken)|next time.*speak/i);
      // SPEC-0006 (BE-6/BE-7): no evidence exists for this session, so no
      // score/rubric/strengths/improvements may be fabricated -- a null
      // score (not a real number, not a made-up low one) is what keeps
      // guardrail #1 true for the new structured fields too.
      expect(r.body.score).toBeNull();
      expect(r.body.dimensions).toEqual([]);
      expect(r.body.strengths).toEqual([]);
      expect(r.body.improvements).toEqual([]);
    }
  });
});
