// BE-1 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0004): pure assembly
// of the open-rooms list from separately-fetched rooms, participant rows,
// and profiles -- same "no DB" shape as domain/sessionHistory.js's
// buildSessionHistory, kept testable without a live database.
import { describe, it, expect } from 'vitest';
import { buildOpenRoomsList } from '../src/domain/roomListing.js';

function room(overrides = {}) {
  return {
    id: 'r1',
    code: 'ABCXYZ',
    duration_seconds: 900,
    max_participants: 6,
    created_by: 'host-1',
    created_at: '2026-08-01T00:00:00.000Z',
    topics: { text: 'Should AI grade exams?' },
    ...overrides,
  };
}

describe('buildOpenRoomsList', () => {
  it('shapes a room with no participants yet', () => {
    const result = buildOpenRoomsList([room()], [], [{ id: 'host-1', display_name: 'Asha' }]);
    expect(result).toEqual([
      {
        id: 'r1',
        code: 'ABCXYZ',
        topicText: 'Should AI grade exams?',
        durationSeconds: 900,
        maxParticipants: 6,
        participantCount: 0,
        hostDisplayName: 'Asha',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  it('counts participant rows per room', () => {
    const participantRows = [
      { room_id: 'r1', user_id: 'a' },
      { room_id: 'r1', user_id: 'b' },
      { room_id: 'r2', user_id: 'c' },
    ];
    const rooms = [room({ id: 'r1' }), room({ id: 'r2', max_participants: 4 })];
    const result = buildOpenRoomsList(rooms, participantRows, []);
    expect(result.find((r) => r.id === 'r1').participantCount).toBe(2);
    expect(result.find((r) => r.id === 'r2').participantCount).toBe(1);
  });

  // R2 (SPEC-0004): a room already at its own capacity must not appear --
  // the list only shows rooms a caller could actually join.
  it('excludes a room that has already reached its own max_participants', () => {
    const full = room({ id: 'full', max_participants: 2 });
    const notFull = room({ id: 'not-full', max_participants: 2 });
    const participantRows = [
      { room_id: 'full', user_id: 'a' },
      { room_id: 'full', user_id: 'b' },
      { room_id: 'not-full', user_id: 'a' },
    ];
    const result = buildOpenRoomsList([full, notFull], participantRows, []);
    expect(result.map((r) => r.id)).toEqual(['not-full']);
  });

  it('falls back to the raw user id when no profile exists for the host', () => {
    const result = buildOpenRoomsList([room({ created_by: 'ghost-user' })], [], []);
    expect(result[0].hostDisplayName).toBe('ghost-user');
  });

  it('resolves topicText to null when no topic is embedded', () => {
    const result = buildOpenRoomsList([room({ topics: null })], [], []);
    expect(result[0].topicText).toBeNull();
  });

  it('returns an empty list for no rooms', () => {
    expect(buildOpenRoomsList([], [], [])).toEqual([]);
  });
});
