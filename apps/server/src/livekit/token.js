// Mint a LiveKit access token. Ported from the validated Phase 0a spike
// (spike/src/token.js) -- used by the student join-token route and by the
// agent worker (as the hidden transcriber participant).
import { AccessToken } from 'livekit-server-sdk';

export async function mintToken(identity, roomName, {
  name = identity,
  canPublish = true,
  canSubscribe = true,
  canPublishData = true,
  hidden = false,
} = {}) {
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET in .env');
  }
  // Phase 1 security gate (ACTION_PLAN.md, 2026-08-04): the SDK defaults
  // to a 6-hour ttl, which massively outlives the room a token is minted
  // for (rooms are capped at 25 minutes -- migration 0010). A leaked join
  // token (logs, browser history, a shared link) would stay a usable
  // room-join credential for hours after the session actually ended.
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, ttl: '30m' });
  at.addGrant({ room: roomName, roomJoin: true, canPublish, canSubscribe, canPublishData, hidden });
  return at.toJwt();
}
