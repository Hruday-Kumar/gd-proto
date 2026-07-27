import { Router } from 'express';
import { buildSessionHistory } from '../domain/sessionHistory.js';

// W7 (Session history): a student's own past sessions -- topic, date,
// status, and their own feedback. Scoped to req.userId throughout (never a
// query parameter), same "own history only" pattern as
// /api/rooms/:id/feedback/mine.
export function createHistoryRouter(requireAuth, deps) {
  const { listRoomIdsForUser, listRoomsByIds, listFeedbackForUserAndRooms } = deps;

  const router = Router();

  router.get('/api/history/mine', requireAuth, async (req, res) => {
    const roomIds = await listRoomIdsForUser(req.userId);
    const rooms = await listRoomsByIds(roomIds);
    const feedbackRows = await listFeedbackForUserAndRooms(req.userId, roomIds);
    res.status(200).json({ sessions: buildSessionHistory(rooms, feedbackRows) });
  });

  return router;
}
