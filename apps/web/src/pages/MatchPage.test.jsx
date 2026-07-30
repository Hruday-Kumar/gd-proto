import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchPage } from './MatchPage.jsx';
import * as roomsApi from '../rooms/roomsApi.js';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: { access_token: 'tok' }, user: { email: 'student@test.edu' }, signOut: vi.fn() }),
}));

vi.mock('../rooms/roomsApi.js', () => ({
  requestMatch: vi.fn(),
  leaveMatchQueue: vi.fn(),
  getActiveRoom: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MatchPage />
    </MemoryRouter>
  );
}

describe('MatchPage cancel-matching affordance', () => {
  beforeEach(() => {
    roomsApi.leaveMatchQueue.mockResolvedValue({});
    roomsApi.getActiveRoom.mockResolvedValue({ room: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show a cancel button before queuing', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /cancel matching/i })).not.toBeInTheDocument();
  });

  it('shows a cancel button once queued, and cancels back to the pre-queue state', async () => {
    const user = userEvent.setup();
    roomsApi.requestMatch.mockResolvedValue({ status: 'queued' });
    renderPage();

    await user.click(screen.getByRole('button', { name: /find me a group/i }));
    const cancelButton = await screen.findByRole('button', { name: /cancel matching/i });

    await user.click(cancelButton);

    expect(roomsApi.leaveMatchQueue).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancel matching/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /find me a group/i })).toBeInTheDocument();
    expect(screen.queryByText(/nobody else is free/i)).not.toBeInTheDocument();
  });
});
