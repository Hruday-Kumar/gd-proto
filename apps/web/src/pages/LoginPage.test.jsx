import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage.jsx';

let resolveSignIn;
const signIn = vi.fn(
  () =>
    new Promise((resolve) => {
      resolveSignIn = resolve;
    })
);

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ signIn: (...args) => signIn(...args) }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage busy state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a spinner and busy label while signing in, hiding the idle arrow icon', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'student@test.edu');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Signing in…')).toBeInTheDocument();
    expect(screen.getByText('progress_activity')).toBeInTheDocument();
    expect(screen.queryByText('arrow_forward')).not.toBeInTheDocument();

    resolveSignIn({ error: null });
  });
});
