import { Router } from 'express';

// First protected route — exists mainly to prove the auth middleware
// actually gates something end-to-end (W2's done-criteria).
export function createMeRouter(requireAuth) {
  const router = Router();
  router.get('/api/me', requireAuth, (req, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return router;
}
