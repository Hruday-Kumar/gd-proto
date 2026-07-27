// Supabase queries for the feedback table (W6). Same injectable-client
// pattern as db/transcriptLines.js. Inserted only via the service-role
// client (server-side, from the feedback generation worker) -- never from
// a student's own client.
import { getSupabase } from './supabase.js';

export async function insertFeedback({ roomId, userId, body, model }, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('feedback')
    .insert({ room_id: roomId, user_id: userId, body, model })
    .select('id, room_id, user_id, body, model, generated_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getFeedbackForRoomAndUser(roomId, userId, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('feedback')
    .select('id, room_id, user_id, body, model, generated_at, rating, rating_reason')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// S1 (pilot-readiness audit): no insert/update RLS policy exists for
// feedback (see 0007_feedback_rating.sql) -- this is only ever called from
// the server after the route has already verified req.userId owns the
// feedback row for this room, same ownership-checked-in-JS pattern as
// every other mutating route in api/rooms.js.
export async function rateFeedback(roomId, userId, { rating, reason }, { supabase = getSupabase() } = {}) {
  const { data, error } = await supabase
    .from('feedback')
    .update({ rating, rating_reason: reason ?? null })
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .select('rating, rating_reason')
    .single();
  if (error) throw error;
  return data;
}

// W7 session history: this student's own feedback across a whole set of
// rooms, scoped to user_id explicitly (not just the room ids) -- same
// "never another participant's paragraph" reasoning as
// getFeedbackForRoomAndUser, just for many rooms at once.
export async function listFeedbackForUserAndRooms(userId, roomIds, { supabase = getSupabase() } = {}) {
  if (!roomIds.length) return [];
  const { data, error } = await supabase.from('feedback').select('room_id, body').eq('user_id', userId).in('room_id', roomIds);
  if (error) throw error;
  return data;
}
