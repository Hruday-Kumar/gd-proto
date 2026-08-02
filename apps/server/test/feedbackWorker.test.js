// N1 (audit comparison, 2026-07-29): generateAndPersistFeedbackForRoom used
// to return void and always regenerate every participant's feedback from
// scratch. Now it skips anyone who already has a persisted row (so a retry
// after a partial failure doesn't re-spend Gemini calls or hit feedback's
// unique(room_id, user_id) constraint) and returns { complete } so
// agent/roomSweeper.js knows whether the room is actually done. All
// dependencies injected -- no live DB or Gemini key needed.
//
// SPEC-0006 (BE-6/BE-7): generateFn now resolves to the structured shape
// domain/feedbackPrompt.js's parseFeedbackResponse produces (summary,
// score, dimensions, strengths, improvements) instead of a bare string --
// insertFeedbackFn must be called with all four new fields, not just body.
import { describe, it, expect, vi } from 'vitest';
import { generateAndPersistFeedbackForRoom } from '../src/agent/feedbackWorker.js';

const participants = [
  { user_id: 'user-a', livekit_identity: 'user-a', joined_at: '2026-07-29T09:00:00.000Z' },
  { user_id: 'user-b', livekit_identity: 'user-b', joined_at: '2026-07-29T09:00:00.000Z' },
];

function structuredFeedback(overrides = {}) {
  return {
    summary: 'Great job staying on topic.',
    score: 82,
    dimensions: ['Content depth', 'Clarity', 'Confidence', 'Listening', 'Fluency'].map((label) => ({
      label,
      score: 80,
      note: 'Specific note.',
    })),
    strengths: ['Clear opening.'],
    improvements: ['Invite others in more.'],
    ...overrides,
  };
}

function baseDeps(overrides = {}) {
  return {
    getRoomByIdFn: vi.fn().mockResolvedValue({ id: 'room-1', topic_id: 'topic-1' }),
    getTopicByIdFn: vi.fn().mockResolvedValue({ id: 'topic-1', text: 'Remote work' }),
    listParticipantsFn: vi.fn().mockResolvedValue(participants),
    listProfilesFn: vi.fn().mockResolvedValue([
      { id: 'user-a', display_name: 'Asha' },
      { id: 'user-b', display_name: 'Bilal' },
    ]),
    listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([
      { user_id: 'user-a', text: 'I think remote work helps.' },
      { user_id: 'user-b', text: 'I disagree.' },
    ]),
    listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue([]),
    insertFeedbackFn: vi.fn().mockResolvedValue(undefined),
    generateFn: vi.fn().mockResolvedValue(structuredFeedback()),
    ...overrides,
  };
}

describe('generateAndPersistFeedbackForRoom', () => {
  it('persists feedback for every participant and reports complete: true', async () => {
    const deps = baseDeps();
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ complete: true });
  });

  it('persists the summary as body plus the score/dimensions/strengths/improvements fields', async () => {
    const deps = baseDeps({
      listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue(['user-b']),
      generateFn: vi.fn().mockResolvedValue(structuredFeedback()),
    });
    await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        body: 'Great job staying on topic.',
        score: 82,
        strengths: ['Clear opening.'],
        improvements: ['Invite others in more.'],
        dimensions: expect.arrayContaining([expect.objectContaining({ label: 'Content depth' })]),
      })
    );
  });

  it('skips participants who already have persisted feedback', async () => {
    const deps = baseDeps({ listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue(['user-a']) });
    await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.generateFn).toHaveBeenCalledTimes(1);
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(1);
    expect(deps.insertFeedbackFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-b' }));
  });

  it('returns complete: true without calling Gemini or reading the transcript when everyone already has feedback', async () => {
    const deps = baseDeps({ listFeedbackUserIdsForRoomFn: vi.fn().mockResolvedValue(['user-a', 'user-b']) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.listTranscriptLinesForRoomFn).not.toHaveBeenCalled();
    expect(deps.generateFn).not.toHaveBeenCalled();
    expect(result).toEqual({ complete: true });
  });

  // The real production incident (PROGRESS.md, 2026-07-29 B7): a dead
  // Gemini service account 401'd every participant's call.
  it('reports complete: false when every participant fails to generate', async () => {
    const deps = baseDeps({ generateFn: vi.fn().mockRejectedValue(new Error('401 service account disabled')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).not.toHaveBeenCalled();
    expect(result).toEqual({ complete: false });
  });

  it('reports complete: false when only some participants succeed', async () => {
    const generateFn = vi.fn().mockImplementation((prompt) => {
      if (prompt.includes('only for Bilal')) return Promise.reject(new Error('quota exceeded'));
      return Promise.resolve('feedback text');
    });
    const deps = baseDeps({ generateFn });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ complete: false });
  });

  it('reports complete: false when generation succeeds but persisting fails', async () => {
    const deps = baseDeps({ insertFeedbackFn: vi.fn().mockRejectedValue(new Error('unique constraint violation')) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);
    expect(result).toEqual({ complete: false });
  });

  it('still returns complete: true for the honest technical-issue message when the transcript is empty', async () => {
    const deps = baseDeps({ listTranscriptLinesForRoomFn: vi.fn().mockResolvedValue([]) });
    const result = await generateAndPersistFeedbackForRoom('room-1', deps);

    expect(deps.generateFn).not.toHaveBeenCalled();
    expect(deps.insertFeedbackFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ complete: true });
  });
});
