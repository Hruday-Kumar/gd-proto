// BE-3 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0003): pure decision
// behind whether a requested room visibility is one of the two allowed
// values. Kept pure (no DB) for the same reason domain/roomDuration.js and
// domain/roomCapacity.js are -- an attacker-controlled request body is the
// real boundary, not the UI's own two-option radio group.
import { describe, it, expect } from 'vitest';
import { isValidVisibility, VALID_VISIBILITIES, DEFAULT_VISIBILITY } from '../src/domain/roomVisibility.js';

describe('isValidVisibility', () => {
  it('accepts every value in VALID_VISIBILITIES', () => {
    for (const value of VALID_VISIBILITIES) {
      expect(isValidVisibility(value)).toBe(true);
    }
  });

  it('the default is itself a valid value', () => {
    expect(isValidVisibility(DEFAULT_VISIBILITY)).toBe(true);
  });

  it.each([
    ['an unrelated string', 'secret'],
    ['wrong case', 'Public'],
    ['a number', 1],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidVisibility(value)).toBe(false);
  });
});
