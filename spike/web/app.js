// PlaceMe GD spike — browser client.
// Responsibilities:
//   1. Join a LiveKit room and publish/subscribe audio (everyone hears everyone).
//   2. Transcribe THIS user's own mic via the browser Web Speech API.
//   3. Broadcast each final transcript line over LiveKit's data channel, tagged
//      to this participant. Remote lines are attributed using the SENDER's
//      LiveKit identity/name — not self-reported text — so attribution is real.
//
// Stage 2 will replace step 2/3 with a server-side Deepgram agent. The room,
// audio, participant list, and transcript UI below stay unchanged.

import { Room, RoomEvent, Track } from 'https://cdn.jsdelivr.net/npm/livekit-client@2/+esm';

// Stage 2: transcripts come from the server-side Deepgram agent (run `npm run
// agent <room>`), broadcast into the room as data. Set this true to fall back to
// the Stage 1 in-browser Web Speech API instead.
const USE_BROWSER_STT = false;

// ── DOM refs ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const joinScreen = $('join-screen');
const roomScreen = $('room-screen');
const nameInput = $('name');
const roomInput = $('room');
const consentBox = $('consent');
const joinBtn = $('join-btn');
const joinError = $('join-error');
const micBtn = $('mic-btn');
const leaveBtn = $('leave-btn');
const participantsEl = $('participants');
const transcriptEl = $('transcript');
const interimEl = $('interim');

// ── State ─────────────────────────────────────────────────────────────
let room = null;
let micOn = false;
let recognition = null;
let wantRecognition = false; // whether STT should be running (mic on + joined)

// Join button enables only when name + room + consent are all present.
function refreshJoinBtn() {
  joinBtn.disabled = !(nameInput.value.trim() && roomInput.value.trim() && consentBox.checked);
}
[nameInput, roomInput].forEach((el) => el.addEventListener('input', refreshJoinBtn));
consentBox.addEventListener('change', refreshJoinBtn);

joinBtn.addEventListener('click', join);
leaveBtn.addEventListener('click', leave);
micBtn.addEventListener('click', toggleMic);

// ── Join flow ─────────────────────────────────────────────────────────
async function join() {
  joinError.hidden = true;
  joinBtn.disabled = true;

  // Record consent (spike: console + timestamp; production must persist this).
  console.log('[consent] granted', {
    name: nameInput.value.trim(),
    room: roomInput.value.trim(),
    at: new Date().toISOString(),
  });

  const roomName = roomInput.value.trim();
  const displayName = nameInput.value.trim();

  try {
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomName, name: displayName }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'token request failed');
    const { token, url } = await res.json();

    room = new Room({ adaptiveStream: true, dynacast: true });
    wireRoomEvents();
    await room.connect(url, token);

    // Show room UI
    joinScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
    $('room-name-label').textContent = `Room: ${roomName}`;
    $('you-label').textContent = `  ·  you are ${displayName}`;
    renderParticipants();

    await toggleMic(); // enable mic + start transcription right away
  } catch (err) {
    console.error(err);
    joinError.textContent = `Could not join: ${err.message}`;
    joinError.hidden = false;
    joinBtn.disabled = false;
  }
}

async function leave() {
  stopRecognition();
  if (room) await room.disconnect();
  room = null;
  micOn = false;
  transcriptEl.innerHTML = '';
  participantsEl.innerHTML = '';
  interimEl.textContent = '';
  roomScreen.classList.add('hidden');
  joinScreen.classList.remove('hidden');
  refreshJoinBtn();
}

// ── LiveKit room events ───────────────────────────────────────────────
function wireRoomEvents() {
  room
    .on(RoomEvent.ParticipantConnected, renderParticipants)
    .on(RoomEvent.ParticipantDisconnected, renderParticipants)
    .on(RoomEvent.Disconnected, () => console.log('[room] disconnected'))
    .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
    .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    .on(RoomEvent.DataReceived, onDataReceived);
}

// Play remote participants' audio.
function onTrackSubscribed(track, _pub, participant) {
  if (track.kind === Track.Kind.Audio) {
    const el = track.attach();
    el.id = `audio-${participant.identity}`;
    $('audio-sink').appendChild(el);
  }
}

// Receive a transcript line broadcast by another participant.
function onDataReceived(payload, participant, _kind, topic) {
  if (topic && topic !== 'transcript') return;
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    if (msg.type !== 'transcript') return;
    // The server agent tags each line with the speaker it transcribed
    // (msg.speaker). For Stage 1 peer broadcasts, fall back to the sender's
    // LiveKit identity.
    const who = msg.speaker || participant?.name || participant?.identity || 'Someone';
    addLine(who, msg.text, false);
  } catch (e) { console.warn('bad data msg', e); }
}

// Green dot on whoever is currently speaking (from LiveKit audio energy).
function onActiveSpeakers(speakers) {
  const speaking = new Set(speakers.map((s) => s.identity));
  participantsEl.querySelectorAll('li').forEach((li) => {
    li.querySelector('.dot').classList.toggle('speaking', speaking.has(li.dataset.identity));
  });
}

function renderParticipants() {
  if (!room) return;
  const all = [room.localParticipant, ...room.remoteParticipants.values()];
  participantsEl.innerHTML = '';
  for (const p of all) {
    const li = document.createElement('li');
    li.dataset.identity = p.identity;
    const isSelf = p === room.localParticipant;
    li.innerHTML =
      `<span class="dot"></span><span>${escapeHtml(p.name || p.identity)}</span>` +
      (isSelf ? ' <span class="you-badge">you</span>' : '');
    participantsEl.appendChild(li);
  }
}

// ── Mic + transcription ───────────────────────────────────────────────
async function toggleMic() {
  if (!room) return;
  micOn = !micOn;
  await room.localParticipant.setMicrophoneEnabled(micOn);
  micBtn.textContent = micOn ? '🎙️ Mic on' : '🔇 Mic off';
  micBtn.classList.toggle('live', micOn);
  if (!USE_BROWSER_STT) return; // Stage 2: server agent transcribes instead
  if (micOn) startRecognition(); else stopRecognition();
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addLine('system', 'Browser speech recognition unavailable — use Chrome or Edge. ' +
      '(Audio still works; only your live transcript is missing.)', false);
    return;
  }
  wantRecognition = true;
  if (recognition) return;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const text = r[0].transcript.trim();
      if (!text) continue;
      if (r.isFinal) {
        addLine(myName(), text, true);         // show my own line locally
        broadcastTranscript(text);             // and to everyone else
      } else {
        interim += text + ' ';
      }
    }
    interimEl.textContent = interim ? `${myName()} (typing…): ${interim}` : '';
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      addLine('system', 'Microphone/transcription permission denied.', false);
      wantRecognition = false;
    }
  };
  // Web Speech stops itself periodically; restart while we still want it.
  recognition.onend = () => {
    if (wantRecognition) { try { recognition.start(); } catch (_) {} }
  };

  try { recognition.start(); } catch (_) {}
}

function stopRecognition() {
  wantRecognition = false;
  interimEl.textContent = '';
  if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
}

function broadcastTranscript(text) {
  if (!room) return;
  const payload = new TextEncoder().encode(JSON.stringify({ type: 'transcript', text }));
  room.localParticipant.publishData(payload, { reliable: true, topic: 'transcript' });
}

// ── UI helpers ────────────────────────────────────────────────────────
function addLine(who, text, isSelf) {
  const line = document.createElement('div');
  line.className = 'line' + (isSelf ? ' self' : '');
  line.innerHTML = `<span class="who">${escapeHtml(who)}</span><span class="what">${escapeHtml(text)}</span>`;
  transcriptEl.appendChild(line);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function myName() {
  return room?.localParticipant?.name || 'You';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

refreshJoinBtn();
