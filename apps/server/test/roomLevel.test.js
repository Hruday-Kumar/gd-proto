// BE-4 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0005): pure
// closed-set check for a room's chosen level, same shape as
// domain/roomVisibility.js's isValidVisibility.
import { describe, it, expect } from 'vitest';
import { isValidLevel, VALID_LEVELS, DEFAULT_LEVEL } from '../src/domain/roomLevel.js';

describe('isValidLevel', () => {
  it('accepts every value in VALID_LEVELS', () => {
    for (const value of VALID_LEVELS) {
      expect(isValidLevel(value)).toBe(true);
    }
  });

  it('the default is itself a valid value', () => {
    expect(isValidLevel(DEFAULT_LEVEL)).toBe(true);
  });

  it.each([
    ['an unrelated string', 'expert'],
    ['wrong case', 'Beginner'],
    ['a number', 1],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidLevel(value)).toBe(false);
  });
});
