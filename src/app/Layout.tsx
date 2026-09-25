import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/', label: 'Notebook', end: true },
  { to: '/analyze', label: 'Analyse', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Layout() {
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
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
