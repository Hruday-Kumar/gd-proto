import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: 'space_dashboard', end: true },
  { to: '/rooms/new', label: 'New Room', icon: 'add_circle' },
  { to: '/rooms/join', label: 'Join by Code', icon: 'meeting_room' },
  { to: '/rooms/match', label: 'Random Match', icon: 'shuffle' },
  { to: '/history', label: 'History', icon: 'history' },
];

function navLinkClasses({ isActive }) {
  return [
    'flex items-center gap-3 rounded-lg px-6 py-3 text-label-md font-medium transition-colors',
    isActive
      ? 'bg-primary-container text-on-primary-container'
      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  ].join(' ');
}

export function AppShell({ children, title, subtitle }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-on-surface md:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-border-base bg-surface-container-lowest p-6 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="material-symbols-outlined text-on-primary">forum</span>
          </div>
          <div>
            <h1 className="text-headline-sm font-bold leading-none text-on-surface">PlaceMe</h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">GD Arena</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClasses}>
              <span className="material-symbols-outlined">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-border-base pt-6">
          <p className="truncate text-label-sm text-on-surface-variant" title={user?.email}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-base px-6 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-base bg-surface-container-lowest px-8 py-3 md:hidden">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">forum</span>
            <span className="text-headline-sm font-bold text-on-surface">PlaceMe</span>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1 text-label-sm text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Log out
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-12">
          {(title || subtitle) && (
            <div className="mb-8">
              {title && <h2 className="text-headline-lg font-bold text-on-surface">{title}</h2>}
              {subtitle && <p className="mt-1 text-body-md text-text-secondary">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>

        <nav className="sticky bottom-0 z-40 flex items-center justify-around border-t border-border-base bg-surface-container-lowest px-3 py-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`
              }
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              <span className="text-[10px] font-semibold">{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
