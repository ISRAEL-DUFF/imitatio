import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { useAppearance } from '@/lib/appearance';
import { useApiKey, usePreferences } from '@/lib/db/settings';
import { useOnline } from '@/lib/useOnline';

const NAV = [
  { to: '/', label: 'Notebook', end: true },
  { to: '/analyze', label: 'Analyse', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
  const prefs = usePreferences();
  const key = useApiKey();
  const { pathname } = useLocation();
  useAppearance(prefs);
  const online = useOnline();

  // First launch with no key opens the onboarding panel in Settings (§9.1).
  if (prefs && !prefs.onboarded && key?.source === 'none' && pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-6">
          <span className="font-classical text-xl tracking-wide">Imitatio</span>
          <nav aria-label="Main" className="flex gap-4 text-sm">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? 'text-accent font-medium' : 'text-muted hover:text-ink'
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          {!online && (
            <span
              role="status"
              className="ml-auto rounded border border-rule px-2 text-xs leading-6 text-muted"
              title="The notebook works offline. Analysis and generation need a connection."
            >
              Offline
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
