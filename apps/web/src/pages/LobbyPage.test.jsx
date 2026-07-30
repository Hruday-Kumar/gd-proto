import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyPage } from './LobbyPage.jsx';
import { RoomSessionGuardProvider } from '../rooms/RoomSessionGuardContext.jsx';
import * as roomsApi from '../rooms/roomsApi.js';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: { access_token: 'tok' }, user: { email: 'student@test.edu' }, signOut: vi.fn() }),
}));

vi.mock('../rooms/roomsApi.js', () => ({
  getRoomStatus: vi.fn(),
  startRoom: vi.fn(),
  getMyFeedback: vi.fn(),
  getRoomTranscript: vi.fn(),
}));

function renderRoom(initialState) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/rooms/room-1', state: initialState }]}>
      <RoomSessionGuardProvider>
        <Routes>
          <Route path="/rooms/:id" element={<LobbyPage />} />
          <Route path="/" element={<div>Home content</div>} />
        </Routes>
      </RoomSessionGuardProvider>
    </MemoryRouter>
  );
}

describe('LobbyPage leave-room affordance', () => {
  beforeEach(() => {
    roomsApi.getMyFeedback.mockResolvedValue({ feedback: null });
    roomsApi.getRoomTranscript.mockResolvedValue({ lines: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Leave room for the creator waiting to start, and navigates home on click', async () => {
    const user = userEvent.setup();
    roomsApi.getRoomStatus.mockResolvedValue({ status: 'waiting', isCreator: true, code: 'ABCDEF' });
    renderRoom({ isCreator: true, code: 'ABCDEF', status: 'waiting' });

    const leaveLink = await screen.findByRole('link', { name: /leave room/i });
    await user.click(leaveLink);

    expect(await screen.findByText('Home content')).toBeInTheDocument();
  });

  it('shows Leave room for a non-creator waiting for the session to start', async () => {
    roomsApi.getRoomStatus.mockResolvedValue({ status: 'waiting', isCreator: false, code: 'ABCDEF' });
    renderRoom({ isCreator: false, code: 'ABCDEF', status: 'waiting' });

    expect(await screen.findByRole('link', { name: /leave room/i })).toBeInTheDocument();
  });

  it('does not show Leave room once the session is live', async () => {
    roomsApi.getRoomStatus.mockResolvedValue({ status: 'live', isCreator: false, code: 'ABCDEF' });
    renderRoom({ isCreator: false, code: 'ABCDEF', status: 'live' });

    await screen.findByText(/connecting to the audio room/i);
    expect(screen.queryByRole('link', { name: /leave room/i })).not.toBeInTheDocument();
  });
});
