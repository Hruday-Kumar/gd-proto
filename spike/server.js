// PlaceMe GD spike — token server + static host.
// Its only job: hand each browser a short-lived LiveKit access token so it can
// join a room. The API secret NEVER leaves the server (browsers only get tokens).
import 'dotenv/config';
import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, PORT = 3000 } = process.env;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error(
    '\n[!] Missing LiveKit config. Copy .env.example to .env and fill in\n' +
    '    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET from https://cloud.livekit.io\n'
  );
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'web')));

// Mint a join token for {room, name}. Grants mic publish, subscribe, and data.
app.post('/api/token', async (req, res) => {
  const { room, name } = req.body || {};
  if (!room || !name) {
    return res.status(400).json({ error: 'room and name are required' });
  }
  // Unique identity so two people with the same display name never collide —
  // attribution is keyed off this identity, not the free-text name.
  const identity = `${name.trim().slice(0, 24)}__${Math.random().toString(36).slice(2, 7)}`;
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: name.trim(),
  });
  at.addGrant({
    room: room.trim(),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  res.json({ token, url: LIVEKIT_URL, identity });
});

app.listen(PORT, () => {
  console.log(`\n  PlaceMe GD spike → http://localhost:${PORT}\n`);
});
