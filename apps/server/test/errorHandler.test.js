// M2 (engineering audit, 2026-07-28): every route in this app is async
// with no try/catch and no error-handling middleware was ever registered.
// Express 5 does auto-forward a rejected route-handler promise to
// next(err), but with nothing listening, Express's own default handler
// takes over -- an HTML error page, not the JSON `{error: ...}` shape
// every other response in this API uses, and nothing is logged anywhere
// the team would actually see it during a live pilot session.
import { describe, it, expect, vi } from 'vitest';
import { createErrorHandler } from '../src/api/errorHandler.js';

function buildRes() {
  const res = { statusCode: null, body: null, headersSent: false };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('createErrorHandler', () => {
  it('logs the error with structured (JSON-parseable) context', () => {
    const logger = { error: vi.fn() };
    const handler = createErrorHandler({ logger });
    const err = new Error('db connection refused');
    const req = { method: 'GET', originalUrl: '/api/rooms/r1/status' };

    handler(err, req, buildRes(), vi.fn());

    expect(logger.error).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logger.error.mock.calls[0][0]);
    expect(logged.message).toBe('db connection refused');
    expect(logged.method).toBe('GET');
    expect(logged.path).toBe('/api/rooms/r1/status');
    expect(logged.stack).toEqual(expect.any(String));
  });

  it('responds with a generic JSON 500 for an unanticipated error, never leaking the raw message', () => {
    const handler = createErrorHandler({ logger: { error: vi.fn() } });
    const err = new Error('SELECT * FROM rooms WHERE secret_column = ...');
    const res = buildRes();

    handler(err, { method: 'GET', originalUrl: '/x' }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('trusts an explicit err.status below 500 as a deliberate, client-safe error', () => {
    const handler = createErrorHandler({ logger: { error: vi.fn() } });
    const err = new Error('invalid room code');
    err.status = 400;
    const res = buildRes();

    handler(err, { method: 'POST', originalUrl: '/api/rooms' }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ error: 'invalid room code' });
  });

  it('delegates to next(err) instead of responding again if headers were already sent', () => {
    const handler = createErrorHandler({ logger: { error: vi.fn() } });
    const err = new Error('boom');
    const res = buildRes();
    res.headersSent = true;
    const next = vi.fn();

    handler(err, { method: 'GET', originalUrl: '/x' }, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
