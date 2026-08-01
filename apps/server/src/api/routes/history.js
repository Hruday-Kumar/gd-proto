import { Router } from 'express';
import { buildSessionHistory } from '../../domain/sessionHistory.js';
import { computeMyTalkShareByRoom } from '../../domain/talkTime.js';
import { listTranscriptLinesForRooms } from '../../db/transcriptLines.js';

// W7 (Session history): a student's own past sessions -- topic, date,
// status, and their own feedback. Scoped to req.userId throughout (never a
// query parameter), same "own history only" pattern as
// /api/rooms/:id/feedback/mine.
export function createHistoryRouter(requireAuth, deps) {
  const {
    listRoomIdsForUser,
    listRoomsByIds,
    listFeedbackForUserAndRooms,
    listTranscriptLinesForRoomsFn = listTranscriptLinesForRooms,
  } = deps;

  const router = Router();

  router.get('/api/history/mine', requireAuth, async (req, res) => {
    const roomIds = await listRoomIdsForUser(req.userId);
    const [rooms, feedbackRows, transcriptLines] = await Promise.all([
      listRoomsByIds(roomIds),
      listFeedbackForUserAndRooms(req.userId, roomIds),
      listTranscriptLinesForRoomsFn(roomIds),
    ]);
    // BE-9 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0009): the
    // caller's own share of each room's total attributed speaking time,
    // computed from one batched transcript fetch across the whole
    // history rather than one query per room.
    const talkShareByRoomId = computeMyTalkShareByRoom(transcriptLines, req.userId);
    res.status(200).json({ sessions: buildSessionHistory(rooms, feedbackRows, talkShareByRoomId) });
  });

  return router;
}
