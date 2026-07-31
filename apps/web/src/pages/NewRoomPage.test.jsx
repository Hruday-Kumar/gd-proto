import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewRoomPage } from './NewRoomPage.jsx';
import * as roomsApi from '../rooms/roomsApi.js';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}));

vi.mock('../rooms/roomsApi.js', () => ({
  createRoom: vi.fn(),
  generateTopic: vi.fn(),
  submitCustomTopic: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <NewRoomPage />
    </MemoryRouter>
  );
}

describe('NewRoomPage busy state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a spinner and busy label on "Generate & create room" while generating', async () => {
    let resolveGenerate;
    roomsApi.generateTopic.mockReturnValue(
      new Promise((resolve) => {
        resolveGenerate = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();

    const generateButton = screen.getByRole('button', { name: /generate & create room/i });
    await user.click(generateButton);

    expect(await within(generateButton).findByText('Working…')).toBeInTheDocument();
    expect(within(generateButton).getByText('progress_activity')).toBeInTheDocument();

    resolveGenerate({ id: 'topic-1', text: 'Topic' });
  });

  it('shows a spinner and busy label on "Create room with this topic" while submitting', async () => {
    let resolveSubmit;
    roomsApi.submitCustomTopic.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByPlaceholderText(/should college attendance be mandatory/i),
      'Is remote work here to stay?'
    );
    const submitButton = screen.getByRole('button', { name: /create room with this topic/i });
    await user.click(submitButton);

    expect(await within(submitButton).findByText('Creating…')).toBeInTheDocument();
    expect(within(submitButton).getByText('progress_activity')).toBeInTheDocument();

    resolveSubmit({ id: 'topic-2', text: 'Topic' });
  });
});
