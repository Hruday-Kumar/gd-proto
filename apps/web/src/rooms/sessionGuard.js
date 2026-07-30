// Single source of truth for "is this student's room session still in
// progress" -- shared by LobbyPage's beforeunload guard and AppShell's
// in-app navigation guard so the two windows can never silently drift apart.
export function isSessionInProgress(status, feedback, feedbackFailed) {
  return status === 'live' || (status === 'ended' && !feedback && !feedbackFailed);
}
