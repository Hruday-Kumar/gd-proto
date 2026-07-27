// W7 (Session history): pure assembly of a student's past-sessions list
// from the separate rooms/topics/feedback reads (kept as separate queries
// rather than one complex join -- same "simpler to read and correct at
// pilot scale" reasoning as db/roomParticipants.js's getActiveRoomForUser).
import { describe, it, expect } from 'vitest';
import { buildSessionHistory } from '../src/domain/sessionHistory.js';

describe('buildSessionHistory', () => {
  it('attaches topic text and the caller\'s own feedback to each room, preserving order', () => {
    const rooms = [
      {
        id: 'r2',
        code: 'CODE2',
        status: 'ended',
        duration_seconds: 300,
        started_at: '2026-07-26T10:00:00.000Z',
        ended_at: '2026-07-26T10:05:00.000Z',
        topics: { text: 'Should AI grade exams?' },
      },
      {
        id: 'r1',
        code: 'CODE1',
        status: 'ended',
        duration_seconds: 300,
        started_at: '2026-07-25T10:00:00.000Z',
        ended_at: '2026-07-25T10:05:00.000Z',
        topics: { text: 'Is remote work good for productivity?' },
      },
    ];
    const feedbackRows = [{ room_id: 'r1', body: 'You stayed on topic throughout.' }];

    const history = buildSessionHistory(rooms, feedbackRows);

    expect(history).toEqual([
      {
        id: 'r2',
        code: 'CODE2',
        status: 'ended',
        durationSeconds: 300,
        topicText: 'Should AI grade exams?',
        startedAt: '2026-07-26T10:00:00.000Z',
        endedAt: '2026-07-26T10:05:00.000Z',
        feedback: null,
      },
      {
        id: 'r1',
        code: 'CODE1',
        status: 'ended',
        durationSeconds: 300,
        topicText: 'Is remote work good for productivity?',
        startedAt: '2026-07-25T10:00:00.000Z',
        endedAt: '2026-07-25T10:05:00.000Z',
        feedback: 'You stayed on topic throughout.',
      },
    ]);
  });

  it('reports feedback: null (not a missing key) for a room still awaiting generation', () => {
    const rooms = [{ id: 'r1', code: 'CODE1', status: 'live', duration_seconds: 300, started_at: null, ended_at: null, topics: null }];
    const history = buildSessionHistory(rooms, []);
    expect(history[0].feedback).toBeNull();
    expect(history[0].topicText).toBeNull();
  });

  it('returns an empty list for a student with no sessions', () => {
    expect(buildSessionHistory([], [])).toEqual([]);
  });
});
