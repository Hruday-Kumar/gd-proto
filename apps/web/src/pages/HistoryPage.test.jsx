import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage.jsx';
import * as roomsApi from '../rooms/roomsApi.js';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: { access_token: 'tok' }, user: { email: 'student@test.edu' }, signOut: vi.fn() }),
}));

vi.mock('../rooms/roomsApi.js', () => ({
  getMyHistory: vi.fn(),
  getRoomTranscript: vi.fn(),
}));

function renderHistory() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  );
}

describe('HistoryPage loading states', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the list skeleton while sessions are loading', async () => {
    let resolveHistory;
    roomsApi.getMyHistory.mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve;
      })
    );
    renderHistory();

    expect(screen.getByTestId('history-list-skeleton')).toBeInTheDocument();

    resolveHistory({ sessions: [] });
    await screen.findByText(/no sessions yet/i);
  });

  it('replaces the skeleton with real content once sessions resolve', async () => {
    roomsApi.getMyHistory.mockResolvedValue({
      sessions: [
        { id: 'r1', topicText: 'AI ethics', status: 'ended', feedback: 'Nice job.', startedAt: null, durationSeconds: 120, code: 'ABC123' },
      ],
    });
    renderHistory();

    expect(await screen.findByText('AI ethics')).toBeInTheDocument();
    expect(screen.queryByTestId('history-list-skeleton')).not.toBeInTheDocument();
  });

  it('shows the existing error copy, not the skeleton, on failure', async () => {
    roomsApi.getMyHistory.mockRejectedValue(new Error('Network error'));
    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    expect(screen.queryByTestId('history-list-skeleton')).not.toBeInTheDocument();
  });

  it('shows the transcript skeleton while a session transcript is loading, then the real lines', async () => {
    roomsApi.getMyHistory.mockResolvedValue({
      sessions: [
        { id: 'r1', topicText: 'AI ethics', status: 'ended', feedback: 'Nice job.', startedAt: null, durationSeconds: 120, code: 'ABC123' },
      ],
    });
    let resolveTranscript;
    roomsApi.getRoomTranscript.mockReturnValue(
      new Promise((resolve) => {
        resolveTranscript = resolve;
      })
    );
    const user = userEvent.setup();
    renderHistory();

    await user.click(await screen.findByRole('button', { name: /view transcript/i }));

    expect(screen.getByTestId('transcript-skeleton')).toBeInTheDocument();

    resolveTranscript({ lines: [{ displayName: 'Alex', text: 'Good point.' }] });
    expect(await screen.findByText(/good point/i)).toBeInTheDocument();
    expect(screen.queryByTestId('transcript-skeleton')).not.toBeInTheDocument();
  });
});
