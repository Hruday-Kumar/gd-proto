import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinRoomPage } from './JoinRoomPage.jsx';
import * as roomsApi from '../rooms/roomsApi.js';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}));

vi.mock('../rooms/roomsApi.js', () => ({
  joinRoomByCode: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <JoinRoomPage />
    </MemoryRouter>
  );
}

describe('JoinRoomPage button consistency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the shared py-3 primary-button height, not the py-6 outlier', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /join room/i });
    expect(button.className).toContain('py-3');
    expect(button.className).not.toContain('py-6');
  });

  it('shows a spinner and busy label while joining', async () => {
    let resolveJoin;
    roomsApi.joinRoomByCode.mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/room code/i), '7K4PQ');
    const button = screen.getByRole('button', { name: /join room/i });
    await user.click(button);

    expect(await screen.findByText('Joining…')).toBeInTheDocument();
    expect(screen.getByText('progress_activity')).toBeInTheDocument();

    resolveJoin({ id: 'room-1', code: '7K4PQ', status: 'waiting' });
  });
});
