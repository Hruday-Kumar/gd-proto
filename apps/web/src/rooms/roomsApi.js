// Thin fetch wrappers for W4's topic/room endpoints. Same
// fetch-with-bearer-token pattern as consent/useConsentStatus.js.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function callApi(session, path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `status ${res.status}`);
  return body;
}

export const generateTopic = (session, { category, difficulty } = {}) =>
  callApi(session, '/api/topics/generate', { method: 'POST', body: JSON.stringify({ category, difficulty }) });

export const submitCustomTopic = (session, { text, category, difficulty }) =>
  callApi(session, '/api/topics/custom', { method: 'POST', body: JSON.stringify({ text, category, difficulty }) });

export const createRoom = (session, { topicId, durationSeconds }) =>
  callApi(session, '/api/rooms', { method: 'POST', body: JSON.stringify({ topicId, durationSeconds }) });

export const joinRoomByCode = (session, code) =>
  callApi(session, '/api/rooms/join', { method: 'POST', body: JSON.stringify({ code }) });

export const requestMatch = (session, { durationSeconds }) =>
  callApi(session, '/api/rooms/match', { method: 'POST', body: JSON.stringify({ durationSeconds }) });

export const leaveMatchQueue = (session) => callApi(session, '/api/rooms/match', { method: 'DELETE' });

export const startRoom = (session, roomId) => callApi(session, `/api/rooms/${roomId}/start`, { method: 'POST' });

export const getRoomStatus = (session, roomId) => callApi(session, `/api/rooms/${roomId}/status`, { method: 'GET' });

export const getActiveRoom = (session) => callApi(session, '/api/rooms/mine/active', { method: 'GET' });

export const getRoomToken = (session, roomId) => callApi(session, `/api/rooms/${roomId}/token`, { method: 'POST' });

export const getRoomParticipants = (session, roomId) =>
  callApi(session, `/api/rooms/${roomId}/participants`, { method: 'GET' });

export const getRoomTranscript = (session, roomId) =>
  callApi(session, `/api/rooms/${roomId}/transcript`, { method: 'GET' });

export const getMyFeedback = (session, roomId) => callApi(session, `/api/rooms/${roomId}/feedback/mine`, { method: 'GET' });

export const rateFeedback = (session, roomId, { rating, reason }) =>
  callApi(session, `/api/rooms/${roomId}/feedback/mine/rating`, { method: 'PATCH', body: JSON.stringify({ rating, reason }) });

export const getMyHistory = (session) => callApi(session, '/api/history/mine', { method: 'GET' });
