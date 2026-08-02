import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignupPage } from './SignupPage.jsx';

let resolveSignUp;
const signUp = vi.fn(
  () =>
    new Promise((resolve) => {
      resolveSignUp = resolve;
    })
);

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ signUp: (...args) => signUp(...args) }),
}));

vi.mock('../lib/analytics.js', () => ({
  track: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );
}

describe('SignupPage busy state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a spinner and busy label while creating the account, hiding the idle arrow icon', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'student@test.edu');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Creating account…')).toBeInTheDocument();
    expect(screen.getByText('progress_activity')).toBeInTheDocument();
    expect(screen.queryByText('arrow_forward')).not.toBeInTheDocument();

    resolveSignUp({ error: null });
  });
});
