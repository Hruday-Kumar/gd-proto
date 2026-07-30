import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getRoomToken, getRoomParticipants } from './roomsApi.js';
import { track } from '../lib/analytics.js';

const decoder = new TextDecoder();
const MAX_CAPTIONS = 20;

// N13 (audit comparison, 2026-07-29): must match the identity
// agent/roomAgent.js mints its own LiveKit token with (`mintTokenFn`
// call, W5). Only that hidden agent participant's token ever carries
// canPublishData (M1, audit 2026-07-28) -- a per-speaker identity isn't
// meaningful here since every caption is relayed through this one bot,
// not published by the speaking student directly. Checking the sender is
// still real defense in depth: if a student token ever regressed to
// carrying canPublishData again, a forged data message wouldn't pass this
// check even though it could still fake the identity field inside its
// own payload.
const TRANSCRIBER_IDENTITY = 'transcriber';

// Joins the room's live LiveKit audio session (W5). Guardrail #3 is
// enforced server-side: the token mint route (api/rooms.js) sits behind
// the W3 consent gate, so this component never even receives a token,
// let alone enables a mic, without current recorded consent -- if the
// student hasn't consented the fetch below fails with consent_required
// and no audio is ever touched.
//
// Captions are a live display convenience: the agent worker
// (agent/roomAgent.js) broadcasts each finalized transcript turn as a
// LiveKit data message on the "transcript" topic, alongside persisting
// the attributed line to the DB. Speaker identity is the student's own
// user_id (see domain/attribution.js), which is also what
// GET /api/rooms/:id/participants resolves to a display name -- so the
// same id used for LiveKit and for captions doubles as the join key here.
export function LiveRoomAudio({ roomId }) {
  const { session, user } = useAuth();
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState(() => new Set());
  const [muted, setMuted] = useState(false);
  const audioContainerRef = useRef(null);
  const captionsEndRef = useRef(null);
  const roomRef = useRef(null);
  const captionIdRef = useRef(0);
  // Supabase hands out a new session object whenever it refreshes the
  // access token. Keying the effects below on `session` would therefore
  // tear down and rejoin the LiveKit room mid-discussion, cutting everyone
  // off; they read the current session through this ref instead and stay
  // keyed on the room alone.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Participant names are independent of the LiveKit connection itself --
  // seating happens at join/match time, well before this component mounts.
  useEffect(() => {
    let cancelled = false;
    getRoomParticipants(sessionRef.current, roomId)
      .then((r) => {
        if (!cancelled) setParticipants(r.participants);
      })
      .catch(() => {
        /* names are a display enhancement; captions still work by id if this fails */
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    // Subscribing to a remote track only delivers the media stream --
    // nothing is actually audible until the track is attached to a
    // playable HTML element. Every other participant's mic audio arrives
    // here and gets attached to a hidden <audio> element for playback.
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      audioContainerRef.current?.appendChild(el);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setActiveSpeakerIds(new Set(speakers.map((s) => s.identity)));
    });

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      // N13 (audit comparison, 2026-07-29): only trust a caption message
      // whose LiveKit sender is genuinely the transcriber agent -- the
      // authenticated `participant` argument LiveKit provides, not
      // anything the payload itself claims. The per-speaker identity
      // inside the payload is still what's displayed (this bot relays
      // every speaker's captions, so the sender is never the speaker
      // directly), but a message from anyone else is dropped outright.
      if (participant?.identity !== TRANSCRIBER_IDENTITY) return;
      try {
        const msg = JSON.parse(decoder.decode(payload));
        if (msg.type !== 'transcript') return;
        const id = captionIdRef.current++;
        setCaptions((prev) => [...prev.slice(-(MAX_CAPTIONS - 1)), { id, identity: msg.identity, text: msg.text }]);
      } catch {
        /* ignore malformed payloads */
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus('disconnected');
    });

    (async () => {
      try {
        const { token, url } = await getRoomToken(sessionRef.current, roomId);
        if (cancelled) return;
        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) setStatus('connected');
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          track('session_join_failed', { roomId, error: e.message });
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [captions]);

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const nextMuted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }

  // Captions arrive continuously, so resolve names through a map built once
  // per participant list rather than a linear scan per caption render.
  const nameById = useMemo(
    () => new Map(participants.map((p) => [p.userId, p.displayName])),
    [participants]
  );

  function nameFor(identity) {
    if (!identity) return 'Someone';
    return nameById.get(identity) ?? identity.slice(0, 8);
  }

  // The token route sits behind the W3 consent gate (guardrail #3). Its
  // raw error is a bare "consent_required"-style string, which left the
  // student staring at a dead end with no idea what to do -- point them at
  // the page that actually unblocks them.
  const needsConsent = Boolean(error) && /consent/i.test(error);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-success' : status === 'disconnected' ? 'bg-danger' : 'animate-pulse bg-tertiary'}`}
          />
          <p className="text-label-md font-semibold capitalize text-on-surface-variant">Mic: {status}</p>
        </div>
        {status === 'connected' && (
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 rounded-lg border border-border-base bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-base">{muted ? 'mic_off' : 'mic'}</span>
            {muted ? 'Unmute' : 'Mute'}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-container px-6 py-3 text-body-sm text-danger">
          {needsConsent ? (
            <p>
              Your microphone stays off until you&apos;ve agreed to the consent terms.{' '}
              <Link to="/consent" className="font-semibold underline">
                Review and agree
              </Link>
              , then come back to this room.
            </p>
          ) : (
            <p>Couldn&apos;t connect you to the audio room: {error}. Try refreshing the page.</p>
          )}
        </div>
      )}
      <div ref={audioContainerRef} style={{ display: 'none' }} />

      {participants.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
          {participants.map((p) => (
            <li key={p.userId} className="flex items-center gap-1.5 text-body-sm text-on-surface">
              <span
                className={`h-2 w-2 rounded-full ${activeSpeakerIds.has(p.userId) ? 'bg-success' : 'bg-outline-variant'}`}
              />
              {p.displayName}
              {p.userId === user?.id ? ' (you)' : ''}
            </li>
          ))}
        </ul>
      )}

      <div
        role="log"
        aria-live="polite"
        className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface-container-low p-3"
      >
        {captions.length === 0 && <p className="text-body-sm text-outline">Live captions will appear here…</p>}
        <ul className="space-y-1">
          {captions.map((c) => (
            <li key={c.id} className="text-body-sm text-on-surface">
              <strong className="text-on-surface-variant">{nameFor(c.identity)}:</strong> {c.text}
            </li>
          ))}
        </ul>
        <div ref={captionsEndRef} />
      </div>
    </div>
  );
}
