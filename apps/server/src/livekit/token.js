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
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name });
  at.addGrant({ room: roomName, roomJoin: true, canPublish, canSubscribe, canPublishData, hidden });
  return at.toJwt();
}
