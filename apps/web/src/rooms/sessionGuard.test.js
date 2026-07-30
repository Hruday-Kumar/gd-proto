import { describe, expect, it } from 'vitest';
import { isSessionInProgress } from './sessionGuard.js';

describe('isSessionInProgress', () => {
  it('is false while waiting for the creator to start', () => {
    expect(isSessionInProgress('waiting', null, false)).toBe(false);
  });

  it('is true while the session is live', () => {
    expect(isSessionInProgress('live', null, false)).toBe(true);
  });

  it('is true when ended but feedback has not arrived or failed yet', () => {
    expect(isSessionInProgress('ended', null, false)).toBe(true);
  });

  it('is false once feedback has arrived', () => {
    expect(isSessionInProgress('ended', 'Great job staying on topic.', false)).toBe(false);
  });

  it('is false once feedback generation has definitively failed', () => {
    expect(isSessionInProgress('ended', null, true)).toBe(false);
  });
});
