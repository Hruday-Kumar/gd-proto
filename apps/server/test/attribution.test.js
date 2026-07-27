// W5 core unit (PHASE1_PLAN.md §5): the mapping from a LiveKit participant
// identity to our own user_id, via that room's room_participants rows.
// Attribution itself is structural (proven in Phase 0a); this pure mapping
// is our code, and exactly where a silent bug would put one student's
// words under another's name -- test it directly.
import { describe, it, expect } from 'vitest';
import { resolveSpeakerUserId } from '../src/domain/attribution.js';

const participants = [
  { user_id: 'user-alice', livekit_identity: 'user-alice' },
  { user_id: 'user-bob', livekit_identity: 'user-bob' },
];

describe('resolveSpeakerUserId', () => {
  it('resolves the correct user_id for a known identity', () => {
    expect(resolveSpeakerUserId(participants, 'user-bob')).toBe('user-bob');
  });

  it('does not cross-attribute to a different participant', () => {
    const result = resolveSpeakerUserId(participants, 'user-alice');
    expect(result).toBe('user-alice');
    expect(result).not.toBe('user-bob');
  });

  it('returns null for an identity with no matching participant, never a guess', () => {
    expect(resolveSpeakerUserId(participants, 'transcriber-bot')).toBeNull();
  });

  it('returns null on an empty participant list', () => {
    expect(resolveSpeakerUserId([], 'user-alice')).toBeNull();
  });
});
