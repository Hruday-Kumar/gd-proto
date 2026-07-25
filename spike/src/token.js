// Mint a LiveKit access token. Used by the server, the transcriber agent, and
// the simulated speaker bots — anything that needs to join a room from Node.
import { AccessToken } from 'livekit-server-sdk';

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

export async function mintToken(identity, roomName, {
  name = identity,
  canPublish = true,
  canSubscribe = true,
  canPublishData = true,
  hidden = false,
} = {}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name });
  at.addGrant({ room: roomName, roomJoin: true, canPublish, canSubscribe, canPublishData, hidden });
  return at.toJwt();
}
