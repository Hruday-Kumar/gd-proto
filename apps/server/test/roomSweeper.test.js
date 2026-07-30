// M10 (audit 2026-07-28). Replaces the write GET /api/rooms/:id/status used
// to perform as a side effect of a read. sweepExpiredRooms() is the
// orchestration that runs on a timer instead: list every 'live' room,
// decide which have timed out (domain/roomSweep.js), and for each one
// *claim* the ended-transition -- same conditional-update contract C3 gave
// db/rooms.js's updateRoomStatus -- then dispatch feedback generation only
// for the caller that actually won the claim. Same pattern as agent/
// roomAgent.js's recoverLiveRooms(): nothing here may throw and stop the
// process, a database hiccup just means this tick did nothing.
//
// N1 (audit comparison, 2026-07-29): the sweeper now also retries feedback
// generation for already-`ended` rooms whose feedback never completed --
// see domain/roomSweep.js's findRoomsReadyForFeedbackRetry for the pure
// decision, and agent/feedbackWorker.js for the { complete } contract this
// file reacts to.
import { describe, it, expect, vi } from 'vitest';
import { sweepExpiredRooms } from '../src/agent/roomSweeper.js';
import { FEEDBACK_RETRY_MAX_ATTEMPTS, FEEDBACK_FLUSH_MAX_WAIT_MS } from '../src/domain/roomSweep.js';

const NOW = Date.parse('2026-07-29T10:00:00.000Z');

function expiredRoom(overrides = {}) {
  return {
    id: 'r1',
    status: 'live',
    ends_at: new Date(NOW - 1_000).toISOString(),
    ...overrides,
  };
}

// A claim that always succeeds, incrementing attempts by one -- matches
// db/rooms.js's real claimFeedbackAttempt contract closely enough for
// these tests without touching a database.
function alwaysClaims() {
  return vi.fn().mockImplementation((roomId, { expectedAttempts }) =>
    Promise.resolve({ id: roomId, feedback_attempts: expectedAttempts + 1 })
  );
}

function fakeAgentStatus() {
  return { recordFeedbackSuccess: vi.fn(), recordFeedbackFailure: vi.fn() };
}

function baseFeedbackDeps(overrides = {}) {
  return {
    claimFeedbackAttemptFn: alwaysClaims(),
    markFeedbackGeneratedFn: vi.fn().mockResolvedValue(undefined),
    listRoomsNeedingFeedbackRetryFn: vi.fn().mockResolvedValue([]),
    agentStatus: fakeAgentStatus(),
    ...overrides,
  };
}

describe('sweepExpiredRooms', () => {
  it('claims the ended transition for an expired room, with a precondition on it still being live', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ id: 'r1', status: 'ended', feedback_attempts: 0 });
    const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(updateRoomStatusFn).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ status: 'ended', expectedStatus: 'live' })
    );
  });

  it('dispatches feedback generation only when it wins the claim', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ id: 'r1', status: 'ended', feedback_attempts: 0 });
    const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(generateFeedbackFn).toHaveBeenCalledWith('r1');
  });

  // C3's original concurrency guarantee, carried over: if two ticks somehow
  // overlap (a slow tick plus a short interval), the claim in the DB -- not
  // JS state -- is what stops both from dispatching feedback.
  it('dispatches feedback only once when the claim is already gone', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue(null); // someone else already claimed it
    const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(generateFeedbackFn).not.toHaveBeenCalled();
  });

  it('does nothing when no live room has expired', async () => {
    const notExpired = expiredRoom({ ends_at: new Date(NOW + 60_000).toISOString() });
    const listLiveRoomsFn = vi.fn().mockResolvedValue([notExpired]);
    const updateRoomStatusFn = vi.fn();
    const generateFeedbackFn = vi.fn();

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(updateRoomStatusFn).not.toHaveBeenCalled();
    expect(generateFeedbackFn).not.toHaveBeenCalled();
  });

  it('sweeps every expired room in one tick, not just the first', async () => {
    const rooms = [expiredRoom({ id: 'a' }), expiredRoom({ id: 'b' })];
    const listLiveRoomsFn = vi.fn().mockResolvedValue(rooms);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
    const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(generateFeedbackFn).toHaveBeenCalledWith('a');
    expect(generateFeedbackFn).toHaveBeenCalledWith('b');
  });

  it('never lets a database read failure throw', async () => {
    const listLiveRoomsFn = vi.fn().mockRejectedValue(new Error('supabase unreachable'));

    await expect(
      sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn: vi.fn(),
        ...baseFeedbackDeps(),
        now: NOW,
      })
    ).resolves.toBeUndefined();
  });

  it('keeps sweeping the other rooms when one claim write fails', async () => {
    const rooms = [expiredRoom({ id: 'a' }), expiredRoom({ id: 'b' })];
    const listLiveRoomsFn = vi.fn().mockResolvedValue(rooms);
    const updateRoomStatusFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce({ status: 'ended', feedback_attempts: 0 });
    const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

    await sweepExpiredRooms({
      listLiveRoomsFn,
      updateRoomStatusFn,
      generateFeedbackFn,
      ...baseFeedbackDeps(),
      now: NOW,
    });

    expect(generateFeedbackFn).toHaveBeenCalledWith('b');
    expect(generateFeedbackFn).not.toHaveBeenCalledWith('a');
  });

  it('does not let a failing feedback dispatch reject the sweep', async () => {
    const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
    const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
    const generateFeedbackFn = vi.fn().mockRejectedValue(new Error('gemini unreachable'));

    await expect(
      sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps(),
        now: NOW,
      })
    ).resolves.toBeUndefined();
  });

  // N1 (audit comparison, 2026-07-29): the retry half of the sweep.
  describe('feedback retry', () => {
    it('retries an already-ended room whose feedback previously failed', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        { id: 'stuck-room', ended_at: new Date(NOW - 5_000).toISOString(), feedback_attempts: 1, feedback_last_attempted_at: null },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).toHaveBeenCalledWith('stuck-room');
    });

    it('does not retry a room still inside its backoff window', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn();
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        {
          id: 'too-soon',
          ended_at: new Date(NOW - 5_000).toISOString(),
          feedback_attempts: 1,
          feedback_last_attempted_at: new Date(NOW - 1_000).toISOString(),
        },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).not.toHaveBeenCalled();
    });

    it('does not retry a room that has exhausted its attempt budget', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn();
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        {
          id: 'given-up',
          ended_at: new Date(NOW - 5_000).toISOString(),
          feedback_attempts: FEEDBACK_RETRY_MAX_ATTEMPTS,
          feedback_last_attempted_at: null,
        },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).not.toHaveBeenCalled();
    });

    it('never lets a failure reading retry candidates throw', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockRejectedValue(new Error('supabase unreachable'));

      await expect(
        sweepExpiredRooms({
          listLiveRoomsFn,
          updateRoomStatusFn: vi.fn(),
          generateFeedbackFn: vi.fn(),
          ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn }),
          now: NOW,
        })
      ).resolves.toBeUndefined();
    });
  });

  // N1: the claim step is what stops the same room's attempt from being
  // double-dispatched -- either by two overlapping sweep ticks, or by the
  // freshly-ended path and the retry-candidates path both finding the same
  // room in one tick.
  describe('feedback attempt claiming', () => {
    it('does not call generate when another tick already claimed this attempt', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
      const generateFeedbackFn = vi.fn();
      const claimFeedbackAttemptFn = vi.fn().mockResolvedValue(null); // lost the claim

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ claimFeedbackAttemptFn }),
        now: NOW,
      });

      expect(claimFeedbackAttemptFn).toHaveBeenCalledWith('r1', { expectedAttempts: 0, at: expect.any(String) });
      expect(generateFeedbackFn).not.toHaveBeenCalled();
    });

    it('never lets a claim failure throw', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
      const claimFeedbackAttemptFn = vi.fn().mockRejectedValue(new Error('db timeout'));

      await expect(
        sweepExpiredRooms({
          listLiveRoomsFn,
          updateRoomStatusFn,
          generateFeedbackFn: vi.fn(),
          ...baseFeedbackDeps({ claimFeedbackAttemptFn }),
          now: NOW,
        })
      ).resolves.toBeUndefined();
    });
  });

  // N1: what happens once generation actually runs -- marking the room
  // done on success, and surfacing health only once retries are spent.
  describe('recording the outcome', () => {
    it('marks the room done and records a feedback success when generation completes', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const markFeedbackGeneratedFn = vi.fn().mockResolvedValue(undefined);
      const agentStatus = fakeAgentStatus();

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ markFeedbackGeneratedFn, agentStatus }),
        now: NOW,
      });

      expect(markFeedbackGeneratedFn).toHaveBeenCalledWith('r1', { at: expect.any(String) });
      expect(agentStatus.recordFeedbackSuccess).toHaveBeenCalledWith('r1');
      expect(agentStatus.recordFeedbackFailure).not.toHaveBeenCalled();
    });

    it('does not mark the room done when generation leaves it incomplete', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({ status: 'ended', feedback_attempts: 0 });
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: false });
      const markFeedbackGeneratedFn = vi.fn().mockResolvedValue(undefined);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ markFeedbackGeneratedFn }),
        now: NOW,
      });

      expect(markFeedbackGeneratedFn).not.toHaveBeenCalled();
    });

    it('does not record a feedback health failure while attempts remain', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: false });
      const agentStatus = fakeAgentStatus();
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        { id: 'still-trying', ended_at: new Date(NOW - 5_000).toISOString(), feedback_attempts: 1, feedback_last_attempted_at: null },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn, agentStatus }),
        now: NOW,
      });

      expect(agentStatus.recordFeedbackFailure).not.toHaveBeenCalled();
    });

    it('records a feedback health failure once the attempt budget is exhausted', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: false });
      const agentStatus = fakeAgentStatus();
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        {
          id: 'last-try',
          ended_at: new Date(NOW - 5_000).toISOString(),
          feedback_attempts: FEEDBACK_RETRY_MAX_ATTEMPTS - 1,
          feedback_last_attempted_at: null,
        },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn, agentStatus }),
        now: NOW,
      });

      expect(agentStatus.recordFeedbackFailure).toHaveBeenCalledWith('last-try', expect.any(Error));
    });

  });

  // N4 (audit comparison, 2026-07-29): feedback generation used to dispatch
  // the instant a room's ends_at passed, fully decoupled from whether
  // agent/roomAgent.js's transcription agent had actually finished flushing
  // that room's last few seconds of speech into transcript_lines. The
  // sweeper now checks isTranscriptionActive(roomId) before attempting
  // feedback and defers (no claim taken) while it's still true.
  describe('transcription flush gating', () => {
    it('does not attempt feedback for a freshly-expired room whose transcription is still flushing', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({
        id: 'r1',
        status: 'ended',
        feedback_attempts: 0,
        ended_at: new Date(NOW).toISOString(),
      });
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const claimFeedbackAttemptFn = alwaysClaims();
      const isTranscriptionActiveFn = vi.fn().mockReturnValue(true);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ claimFeedbackAttemptFn, isTranscriptionActiveFn }),
        now: NOW,
      });

      // Room ending itself still happens on schedule -- only feedback is deferred.
      expect(updateRoomStatusFn).toHaveBeenCalled();
      expect(claimFeedbackAttemptFn).not.toHaveBeenCalled();
      expect(generateFeedbackFn).not.toHaveBeenCalled();
    });

    it('proceeds normally when transcription is not active for the room (default signal)', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({
        id: 'r1',
        status: 'ended',
        feedback_attempts: 0,
        ended_at: new Date(NOW).toISOString(),
      });
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps(),
        now: NOW,
      });

      expect(generateFeedbackFn).toHaveBeenCalledWith('r1');
    });

    it('proceeds anyway once the flush max-wait window has elapsed, even if still marked active (stuck agent)', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const isTranscriptionActiveFn = vi.fn().mockReturnValue(true);
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        {
          id: 'stuck-transcriber',
          ended_at: new Date(NOW - FEEDBACK_FLUSH_MAX_WAIT_MS - 1).toISOString(),
          feedback_attempts: 0,
          feedback_last_attempted_at: null,
        },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn, isTranscriptionActiveFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).toHaveBeenCalledWith('stuck-transcriber');
    });

    it('defers a retry-path room still inside the flush max-wait window while transcription is active', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn();
      const isTranscriptionActiveFn = vi.fn().mockReturnValue(true);
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        {
          id: 'still-flushing',
          ended_at: new Date(NOW - 1_000).toISOString(),
          feedback_attempts: 0,
          feedback_last_attempted_at: null,
        },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn, isTranscriptionActiveFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).not.toHaveBeenCalled();
    });

    it('handles multiple rooms ending in the same tick independently -- one still flushing, one already done', async () => {
      const rooms = [expiredRoom({ id: 'still-flushing' }), expiredRoom({ id: 'already-done' })];
      const listLiveRoomsFn = vi.fn().mockResolvedValue(rooms);
      const updateRoomStatusFn = vi.fn().mockImplementation((id) =>
        Promise.resolve({ id, status: 'ended', feedback_attempts: 0, ended_at: new Date(NOW).toISOString() })
      );
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const isTranscriptionActiveFn = vi.fn().mockImplementation((id) => id === 'still-flushing');

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ isTranscriptionActiveFn }),
        now: NOW,
      });

      expect(generateFeedbackFn).not.toHaveBeenCalledWith('still-flushing');
      expect(generateFeedbackFn).toHaveBeenCalledWith('already-done');
    });

    it('does not consume a retry attempt while deferring for an active transcription', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([expiredRoom()]);
      const updateRoomStatusFn = vi.fn().mockResolvedValue({
        id: 'r1',
        status: 'ended',
        feedback_attempts: 0,
        ended_at: new Date(NOW).toISOString(),
      });
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const claimFeedbackAttemptFn = alwaysClaims();
      const isTranscriptionActiveFn = vi.fn().mockReturnValue(true);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn,
        generateFeedbackFn,
        ...baseFeedbackDeps({ claimFeedbackAttemptFn, isTranscriptionActiveFn }),
        now: NOW,
      });

      expect(claimFeedbackAttemptFn).not.toHaveBeenCalled();
    });
  });

  describe('recording the outcome (continued)', () => {
    it('records a feedback success again after a prior failure, once a room completes on retry', async () => {
      const listLiveRoomsFn = vi.fn().mockResolvedValue([]);
      const generateFeedbackFn = vi.fn().mockResolvedValue({ complete: true });
      const agentStatus = fakeAgentStatus();
      const listRoomsNeedingFeedbackRetryFn = vi.fn().mockResolvedValue([
        { id: 'recovered', ended_at: new Date(NOW - 5_000).toISOString(), feedback_attempts: 2, feedback_last_attempted_at: null },
      ]);

      await sweepExpiredRooms({
        listLiveRoomsFn,
        updateRoomStatusFn: vi.fn(),
        generateFeedbackFn,
        ...baseFeedbackDeps({ listRoomsNeedingFeedbackRetryFn, agentStatus }),
        now: NOW,
      });

      expect(agentStatus.recordFeedbackSuccess).toHaveBeenCalledWith('recovered');
    });
  });
});
