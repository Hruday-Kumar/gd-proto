// Bug fix, 2026-07-27: the transcription agent's LiveKit connect had no
// retry, so a single transient network blip (confirmed live: "failed to
// retrieve region info: error sending request for url") permanently killed
// transcription for the whole room -- no recovery attempt, ever. This is a
// small, pure, injectable-delay retry helper so that call site (and any
// other flaky-network call) can retry a bounded number of times before
// giving up for real.
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/domain/retry.js';

describe('withRetry', () => {
  it('returns the result on the first successful attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { attempts: 3, delayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and returns the result once a later attempt succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { attempts: 3, delayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once every attempt is exhausted', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockRejectedValueOnce(new Error('boom 3 -- final'));
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow('boom 3 -- final');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry at all when attempts is 1', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('only try'));
    await expect(withRetry(fn, { attempts: 1, delayMs: 0 })).rejects.toThrow('only try');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry with the error and attempt number for every failed attempt', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom 1')).mockResolvedValue('ok');
    await withRetry(fn, { attempts: 3, delayMs: 0, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom 1' }), 1);
  });

  // Gemini fetch timeout + retry (2026-07-30 pilot-readiness pass):
  // withRetry was only ever wired to a call site whose failures are all
  // equally worth retrying (a transient LiveKit network blip). A 4xx
  // response like a bad/expired API key is permanent -- retrying it three
  // times just delays surfacing a real problem by no benefit. shouldRetry
  // lets a caller opt out of retrying a specific error without duplicating
  // this loop.
  it('stops immediately without retrying when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent failure'));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(withRetry(fn, { attempts: 3, delayMs: 0, shouldRetry })).rejects.toThrow('permanent failure');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({ message: 'permanent failure' }));
  });

  it('keeps retrying every attempt when shouldRetry is not provided (unchanged default)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom 1')).mockResolvedValue('ok');
    const result = await withRetry(fn, { attempts: 3, delayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
