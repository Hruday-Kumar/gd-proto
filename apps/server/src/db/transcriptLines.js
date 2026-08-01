// Supabase queries for the transcript_lines table (W5). Written by the
// agent worker only, after resolving a LiveKit identity to a user_id via
// room_participants (see domain/attribution.js) -- never written from a
// student's own client.
import { getSupabase } from './supabase.js';

export async function insertTranscriptLine(
  { roomId, userId, text, startedAtMs, endedAtMs },
  { supabase = getSupabase() } = {}
) {
  const { data, error } = await supabase
    .from('transcript_lines')
    .insert({
      room_id: roomId,
      user_id: userId,
      text,
      started_at_ms: startedAtMs,
      ended_at_ms: endedAtMs,
    })
    .select('id, room_id, user_id, text, started_at_ms, ended_at_ms')
    .single();
  if (error) throw error;
  return data;
}

// M9 (audit 2026-07-28): a single room is bounded in real time by
// roomDuration.js's 25-minute cap, so this is a defensive ceiling against a
// pathological flood of tiny utterances (or a future bug re-inserting
// lines), not a limit expected to bind for any real session -- truncating
// a genuine transcript would silently degrade feedback quality, which
// matters more here than in the other M9 call sites.
const MAX_TRANSCRIPT_LINES = 5000;

// Used by W6 feedback generation (whole-room context) and by the W5
// regression harness to verify attribution landed correctly.
export async function listTranscriptLinesForRoom(roomId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('transcript_lines')
    .select('id, user_id, text, started_at_ms, ended_at_ms')
    .eq('room_id', roomId)
    .order('started_at_ms', { ascending: true })
    .limit(MAX_TRANSCRIPT_LINES);
  if (error) throw error;
  return data;
}

// BE-9 (place-me-UI/docs/BACKEND_REQUIREMENTS.md, SPEC-0009): one batched
// query across every room in a student's history, not one query per room
// (the same batch-don't-loop lesson BE-1/BE-10 already established) --
// backs GET /api/history/mine's per-session talk-share. No `text` in the
// projection: this path only ever needs timing to compute a percentage,
// never the spoken content, so it isn't selected.
const MAX_HISTORY_TRANSCRIPT_LINES = 20000;

export async function listTranscriptLinesForRooms(roomIds, { supabase = getSupabase() } = {}) {
  if (!roomIds.length) return [];
  const { data, error } = await supabase
    .from('transcript_lines')
    .select('room_id, user_id, started_at_ms, ended_at_ms')
    .in('room_id', roomIds)
    .limit(MAX_HISTORY_TRANSCRIPT_LINES);
  if (error) throw error;
  return data ?? [];
}
