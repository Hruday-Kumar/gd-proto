import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { ButtonBusyLabel } from '../components/ButtonBusyLabel.jsx';

const inputClasses =
  'w-full rounded-lg border border-border-base bg-surface-container-lowest py-3 pl-10 pr-4 text-body-md text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate('/');
  }

  return (
    <AuthShell>
      <header className="mb-8 text-center">
        <h1 className="text-headline-lg font-bold text-on-surface">Sign in</h1>
        <p className="mt-1 text-body-md text-text-secondary">Join or start a live group discussion room.</p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="block text-label-md font-medium text-on-surface" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
              mail
            </span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-label-md font-medium text-on-surface" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
              lock
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClasses} pr-10`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-container px-3 py-2 text-body-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary py-3 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? (
            <ButtonBusyLabel label="Signing in…" />
          ) : (
            <>
              Sign in
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-body-sm text-text-secondary">
        Need an account?{' '}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
