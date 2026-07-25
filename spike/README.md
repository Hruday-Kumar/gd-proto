# PlaceMe — GD Arena de-risk spike (Phase 0a)

Throwaway code. Its only purpose: prove that **3+ real people can join one audio
room, speak, and get a live transcript correctly attributed to each speaker** —
cheaply and within our timeline. This is **not** the final architecture.

- **Room/audio:** LiveKit Cloud (free tier)
- **Stage 2 transcription (current):** a server-side agent subscribes to each
  participant's audio track and transcribes it with **Deepgram**. Because each
  participant is a separate track, attribution is structural — we always know who
  said what. ✅ **Validated** by an automated, human-free self-test (below).
- **Stage 1 (superseded):** browser Web Speech API. Retained only as a fallback
  flag (`USE_BROWSER_STT` in `web/app.js`); server-side STT is the real path.

## Test it yourself — no humans needed (recommended, since you're solo)

```
npm run gen-voices     # once: makes 3 TTS voice clips in media/ (Windows SAPI)
npm run selftest       # spins up 3 speaking bots + the transcriber, asserts attribution
```

`selftest` needs both LiveKit and Deepgram keys in `.env`. It joins a fresh room,
has three bots speak distinct sentences at the same time, transcribes each with
Deepgram, and prints PASS/FAIL for whether each speaker's words were attributed
to the right speaker. Exit code 0 = pass. (Add `NODE_ENV=production` to silence
the SDK's `lk-rtc` debug lines.)

---

## One-time setup (~5 min)

1. **Create a free LiveKit Cloud project** at <https://cloud.livekit.io> — pick the
   **Build** plan (permanently free, no credit card).
2. In the project: **Settings → Keys → Create key**. Copy the **API Key**,
   **API Secret**, and the project **URL** (looks like `wss://xxxx.livekit.cloud`).
3. In this `spike/` folder, copy `.env.example` to `.env` and paste those three
   values in.
4. Install dependencies (already done if you ran `npm install` here):
   ```
   npm install
   ```

## Run it

```
npm start
```
Then open **http://localhost:3000** in **Chrome or Edge**.

## Watch it live in the browser (optional human check)

Three terminals, same room code:

```
npm start                 # 1) web server → open http://localhost:3000, join room "gd-test-1"
npm run agent gd-test-1   # 2) server-side transcriber joins the same room
npm run bots gd-test-1    # 3) sends 3 speaking bots in; watch them transcribe live
```

You can also just join in the browser and speak yourself — the agent transcribes
your mic and shows it attributed to your name. For a multi-person feel, add the
bots. (Real people can join from other laptops at `http://<your-LAN-IP>:3000`.)

Things worth eyeballing: audio clarity/lag, that each line lands on the right
speaker, behaviour on overlap, any console errors.

## Notes / known limits (expected for a spike)

- Web Speech API is **Chrome/Edge only** and quality varies — this is *why*
  Stage 2 moves transcription server-side to Deepgram.
- Consent is logged to the browser console only. Production must **persist**
  recorded consent before enabling any mic (see `.claude/rules/guardrails.md`).
- No recording is stored anywhere in this spike.
