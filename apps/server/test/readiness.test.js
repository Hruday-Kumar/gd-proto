import { describe, it, expect } from 'vitest';
import { findMissingEnvVars, REQUIRED_ENV_VARS } from '../src/domain/readiness.js';

describe('findMissingEnvVars', () => {
  it('returns an empty list when every required var is set', () => {
    const env = Object.fromEntries(REQUIRED_ENV_VARS.map((name) => [name, 'x']));
    expect(findMissingEnvVars(env)).toEqual([]);
  });

  it('names every missing or empty var, not just the first', () => {
    const env = Object.fromEntries(REQUIRED_ENV_VARS.map((name) => [name, 'x']));
    delete env.SUPABASE_URL;
    env.GEMINI_API_KEY = '';
    expect(findMissingEnvVars(env)).toEqual(['SUPABASE_URL', 'GEMINI_API_KEY']);
  });
});
