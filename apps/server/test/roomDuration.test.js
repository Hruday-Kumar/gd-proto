// H3 (audit 2026-07-28) core unit. POST /api/rooms and POST /api/rooms/match
// checked only `!durationSeconds`, so anything truthy was written straight
// into the rooms table. The UI lets a student type any number of minutes
// (DurationPicker.jsx), but the API is the security boundary, not the input.
//
// Two things break at once with an out-of-range value, and neither is
// visible to a student:
//   - a huge duration puts ends_at years away, so isTimerExpired() never
//     fires, the room stays 'live' forever, and feedback is never dispatched;
//   - the agent's own stop timer is setTimeout(durationSeconds * 1000), which
//     overflows int32 and fires at 1ms instead -- the transcriber disconnects
//     immediately and the session runs on with no transcript at all.
import { describe, it, expect } from 'vitest';
import { isValidDurationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS } from '../src/domain/roomDuration.js';

describe('isValidDurationSeconds', () => {
  it('accepts every whole minute value the UI can produce (1-25 min input)', () => {
    for (const minutes of [1, 5, 10, 15, 20, 25]) {
      expect(isValidDurationSeconds(minutes * 60)).toBe(true);
    }
  });

  it('accepts the inclusive bounds', () => {
    expect(isValidDurationSeconds(MIN_DURATION_SECONDS)).toBe(true);
    expect(isValidDurationSeconds(MAX_DURATION_SECONDS)).toBe(true);
  });

  // 2026-07-28, direct user request: cap live sessions at 25 minutes. The
  // 60-minute bound above was correct defence-in-depth for H3's actual bug
  // (int32 overflow / a runaway timer), but 30+ minutes is a product decision
  // this project has never wanted -- it's well past the "quick practice
  // round" the GD Arena is for.
  it('rejects a duration past the 25 minute product cap', () => {
    expect(isValidDurationSeconds(30 * 60)).toBe(false);
  });

  it('rejects a duration long enough to overflow the agent stop timer', () => {
    // setTimeout(2000000000 * 1000) exceeds int32 and fires at 1ms.
    expect(isValidDurationSeconds(2_000_000_000)).toBe(false);
    expect(isValidDurationSeconds(MAX_DURATION_SECONDS + 1)).toBe(false);
  });

  it('rejects zero, negative, and below-minimum durations', () => {
    expect(isValidDurationSeconds(0)).toBe(false);
    expect(isValidDurationSeconds(-5)).toBe(false);
    expect(isValidDurationSeconds(MIN_DURATION_SECONDS - 1)).toBe(false);
  });

  it('rejects non-integers', () => {
    // duration_seconds is an integer column; 0.5 would be silently truncated.
    expect(isValidDurationSeconds(0.5)).toBe(false);
    expect(isValidDurationSeconds(600.5)).toBe(false);
  });

  it('rejects anything that is not a number at all', () => {
    // JSON bodies are attacker-controlled: a string, array or object here
    // reaches the integer column and fails as an opaque 500 instead of a 400.
    for (const value of ['600', 'abc', null, undefined, true, [600], { seconds: 600 }, NaN, Infinity]) {
      expect(isValidDurationSeconds(value)).toBe(false);
    }
  });
});
