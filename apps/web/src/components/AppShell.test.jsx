import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell.jsx';
import { RoomSessionGuardProvider, useSetRoomSessionGuard } from '../rooms/RoomSessionGuardContext.jsx';

const mockSignOut = vi.fn();

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { email: 'student@test.edu' }, signOut: mockSignOut }),
}));

const GUARD_MESSAGE = 'Leaving now will disconnect your microphone from the live session.';

function RoomPage({ guardActive }) {
  useSetRoomSessionGuard(guardActive, GUARD_MESSAGE);
  return <AppShell>Room content</AppShell>;
}

function HomePage() {
  return <AppShell>Home content</AppShell>;
}

function HistoryPage() {
  return <AppShell>History content</AppShell>;
}

function renderApp({ guardActive }) {
  return render(
    <MemoryRouter initialEntries={['/rooms/abc']}>
      <RoomSessionGuardProvider>
        <Routes>
          <Route path="/rooms/:id" element={<RoomPage guardActive={guardActive} />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </RoomSessionGuardProvider>
    </MemoryRouter>
  );
}

describe('AppShell navigation guard', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates immediately with no confirmation when no session is in progress', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderApp({ guardActive: false });

    await user.click(screen.getAllByRole('link', { name: /history/i })[0]);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText('History content')).toBeInTheDocument();
  });

  it('blocks navigation when the session is in progress and the user cancels', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp({ guardActive: true });

    await user.click(screen.getAllByRole('link', { name: /history/i })[0]);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining(GUARD_MESSAGE));
    expect(screen.getByText('Room content')).toBeInTheDocument();
    expect(screen.queryByText('History content')).not.toBeInTheDocument();
  });

  it('allows navigation when the session is in progress and the user confirms', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp({ guardActive: true });

    await user.click(screen.getAllByRole('link', { name: /history/i })[0]);

    expect(screen.getByText('History content')).toBeInTheDocument();
  });

  it('gates "Log out" behind the same confirmation while a session is in progress', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp({ guardActive: true });

    await user.click(screen.getAllByRole('button', { name: /log out/i })[0]);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining(GUARD_MESSAGE));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('logs out immediately with no confirmation when no session is in progress', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderApp({ guardActive: false });

    await user.click(screen.getAllByRole('button', { name: /log out/i })[0]);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
