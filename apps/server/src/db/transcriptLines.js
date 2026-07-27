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

// Used by W6 feedback generation (whole-room context) and by the W5
// regression harness to verify attribution landed correctly.
export async function listTranscriptLinesForRoom(roomId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('transcript_lines')
    .select('id, user_id, text, started_at_ms, ended_at_ms')
    .eq('room_id', roomId)
    .order('started_at_ms', { ascending: true });
  if (error) throw error;
  return data;
}
