// M6 (engineering audit, 2026-07-28): CORS was wide open (`cors()` with no
// origin restriction) -- any website could call this API from a logged-in
// student's browser using their session. Not CSRF-exploitable per se
// (auth is a bearer token, not a cookie), but there's no reason a
// deployed API should accept requests from an arbitrary origin once the
// real frontend origin is known.
import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, parseAllowedOrigins } from '../src/domain/corsConfig.js';

describe('parseAllowedOrigins', () => {
  it('parses a comma-separated list, trimming whitespace', () => {
    expect(parseAllowedOrigins('https://a.example.com, https://b.example.com')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('returns an empty array for unset/blank input', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });

  it('drops empty entries from trailing/double commas', () => {
    expect(parseAllowedOrigins('https://a.example.com,,')).toEqual(['https://a.example.com']);
  });
});

describe('isAllowedOrigin', () => {
  it('allows a request with no Origin header (non-browser callers: curl, server-to-server, tests)', () => {
    expect(isAllowedOrigin(undefined, ['https://a.example.com'])).toBe(true);
  });

  it('allows an origin present in the allowlist', () => {
    expect(isAllowedOrigin('https://a.example.com', ['https://a.example.com', 'https://b.example.com'])).toBe(true);
  });

  it('rejects an origin absent from the allowlist', () => {
    expect(isAllowedOrigin('https://evil.example.com', ['https://a.example.com'])).toBe(false);
  });
});
