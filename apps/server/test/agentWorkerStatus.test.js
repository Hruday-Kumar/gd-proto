// W8: the transcription agent dispatch is fire-and-forget (rooms.js's
// /start and /status routes both say so explicitly) -- a failed or never-
// started agent fails *silently* from a student's point of view (room
// works, nobody's speech gets transcribed). This tracker makes that
// visible on a health endpoint instead of only in server logs.
import { describe, it, expect } from 'vitest';
import { createAgentWorkerStatus } from '../src/domain/agentWorkerStatus.js';

describe('createAgentWorkerStatus', () => {
  it('starts healthy with no active rooms', () => {
    const status = createAgentWorkerStatus();
    expect(status.getStatus()).toEqual({
      activeRooms: 0,
      dispatchSuccesses: 0,
      dispatchFailures: 0,
      lastFailure: null,
      lastSuccess: null,
      healthy: true,
      feedbackSuccesses: 0,
      feedbackFailures: 0,
      lastFeedbackFailure: null,
      lastFeedbackSuccess: null,
      feedbackHealthy: true,
    });
  });

  it('increments activeRooms and dispatchSuccesses on a successful dispatch', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchSuccess('room-1');
    const s = status.getStatus();
    expect(s.activeRooms).toBe(1);
    expect(s.dispatchSuccesses).toBe(1);
    expect(s.healthy).toBe(true);
  });

  // L5 (audit 2026-07-28): recordDispatchSuccess used to accept and discard
  // roomId, so a success event -- unlike a failure -- couldn't be
  // correlated to which room it was for.
  it('records roomId with a successful dispatch for correlation', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchSuccess('room-1');
    expect(status.getStatus().lastSuccess).toMatchObject({ roomId: 'room-1' });
  });

  it('records a failure and flips healthy to false', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchFailure('room-1', new Error('LiveKit connect timed out'));
    const s = status.getStatus();
    expect(s.dispatchFailures).toBe(1);
    expect(s.lastFailure).toMatchObject({ roomId: 'room-1', message: 'LiveKit connect timed out' });
    expect(s.healthy).toBe(false);
  });

  it('does not let activeRooms go negative when a room stops without a matching start', () => {
    const status = createAgentWorkerStatus();
    status.recordRoomStopped('room-1');
    expect(status.getStatus().activeRooms).toBe(0);
  });

  it('decrements activeRooms when a room stops', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchSuccess('room-1');
    status.recordRoomStopped('room-1');
    expect(status.getStatus().activeRooms).toBe(0);
  });

  it('reports healthy again once a later dispatch succeeds after an earlier failure', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchFailure('room-1', new Error('boom'));
    expect(status.getStatus().healthy).toBe(false);

    status.recordDispatchSuccess('room-2');
    expect(status.getStatus().healthy).toBe(true);
    // the failure itself stays on the record -- it's the recency, not the
    // count, that determines "healthy right now"
    expect(status.getStatus().dispatchFailures).toBe(1);
  });

  it('reports unhealthy again once a later dispatch fails after an earlier success', () => {
    const status = createAgentWorkerStatus();
    status.recordDispatchSuccess('room-1');
    status.recordDispatchFailure('room-2', new Error('boom'));
    expect(status.getStatus().healthy).toBe(false);
  });

  // N1 (audit comparison, 2026-07-29): a separate set of counters for
  // feedback generation's own dispatch health -- parallel to the
  // transcription counters above, but tracked independently since feedback
  // has no "active" concept and its failure is only recorded once retries
  // are exhausted (agent/roomSweeper.js), not on every transient attempt.
  describe('feedback tracking', () => {
    it('records a successful feedback generation, correlated to its room', () => {
      const status = createAgentWorkerStatus();
      status.recordFeedbackSuccess('room-1');
      const s = status.getStatus();
      expect(s.feedbackSuccesses).toBe(1);
      expect(s.lastFeedbackSuccess).toMatchObject({ roomId: 'room-1' });
      expect(s.feedbackHealthy).toBe(true);
    });

    it('records a feedback failure and flips feedbackHealthy to false', () => {
      const status = createAgentWorkerStatus();
      status.recordFeedbackFailure('room-1', new Error('exhausted retries'));
      const s = status.getStatus();
      expect(s.feedbackFailures).toBe(1);
      expect(s.lastFeedbackFailure).toMatchObject({ roomId: 'room-1', message: 'exhausted retries' });
      expect(s.feedbackHealthy).toBe(false);
    });

    it('reports feedbackHealthy again once a later success follows an earlier failure', () => {
      const status = createAgentWorkerStatus();
      status.recordFeedbackFailure('room-1', new Error('boom'));
      status.recordFeedbackSuccess('room-2');
      const s = status.getStatus();
      expect(s.feedbackHealthy).toBe(true);
      expect(s.feedbackFailures).toBe(1);
    });

    it('keeps transcription and feedback health independent of one another', () => {
      const status = createAgentWorkerStatus();
      status.recordDispatchFailure('room-1', new Error('livekit down'));
      status.recordFeedbackSuccess('room-1');
      const s = status.getStatus();
      expect(s.healthy).toBe(false);
      expect(s.feedbackHealthy).toBe(true);
    });
  });
});
