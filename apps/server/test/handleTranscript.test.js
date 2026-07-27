// W5: the glue between attribution (domain/attribution.js, already tested)
// and persistence (db/transcriptLines.js) -- exactly where a silent bug
// would put one student's words under another's name, or persist a line
// nobody said. injected insertTranscriptLine, no live DB or network.
import { describe, it, expect, vi } from 'vitest';
import { persistAttributedLine } from '../src/agent/handleTranscript.js';

const participants = [
  { user_id: 'user-alice', livekit_identity: 'user-alice' },
  { user_id: 'user-bob', livekit_identity: 'user-bob' },
];

describe('persistAttributedLine', () => {
  it('persists a transcript line attributed to the correct user_id', async () => {
    const insertTranscriptLine = vi.fn().mockResolvedValue({ id: 't1' });
    const result = await persistAttributedLine(
      { participants, identity: 'user-bob', text: 'hello there', startedAtMs: 100, endedAtMs: 200, roomId: 'r1' },
      { insertTranscriptLine }
    );
    expect(insertTranscriptLine).toHaveBeenCalledWith({
      roomId: 'r1',
      userId: 'user-bob',
      text: 'hello there',
      startedAtMs: 100,
      endedAtMs: 200,
    });
    expect(result).toEqual({ id: 't1' });
  });

  it('never persists a line for an identity with no matching participant', async () => {
    const insertTranscriptLine = vi.fn();
    const result = await persistAttributedLine(
      { participants, identity: 'transcriber-bot', text: 'stray audio', startedAtMs: 100, endedAtMs: 200, roomId: 'r1' },
      { insertTranscriptLine }
    );
    expect(insertTranscriptLine).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not cross-attribute between two participants in the same room', async () => {
    const insertTranscriptLine = vi.fn().mockResolvedValue({ id: 't2' });
    await persistAttributedLine(
      { participants, identity: 'user-alice', text: 'my turn', startedAtMs: 0, endedAtMs: 50, roomId: 'r1' },
      { insertTranscriptLine }
    );
    expect(insertTranscriptLine).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-alice' }));
    expect(insertTranscriptLine).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-bob' }));
  });
});
