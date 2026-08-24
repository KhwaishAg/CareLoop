import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const NAV: Record<string, { to: string; label: string; end?: boolean }[]> = {
  PATIENT: [
    { to: "/dashboard", label: "Home", end: true },
    { to: "/book", label: "Book" },
    { to: "/waitlist", label: "Waitlist" },
    { to: "/medications", label: "Medications" },
  ],
  DOCTOR: [
    { to: "/doctor", label: "Today", end: true },
    { to: "/doctor/follow-ups", label: "Follow-ups" },
    { to: "/doctor/settings", label: "Settings" },
  ],
  ADMIN: [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/doctors", label: "Doctors" },
    { to: "/admin/waitlist", label: "Waitlist" },
    { to: "/admin/notifications", label: "Notifications" },
  ],
};

export function PortalLayout({ homePath }: { homePath: string }) {
  const { user, logout } = useAuth();
  const nav = user ? NAV[user.role] ?? [] : [];

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-8">
          <Link to={homePath} className="font-mono text-sm uppercase tracking-widest text-accent">
            CareLoop
          </Link>
          <nav className="flex items-center gap-5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-sm transition ${isActive ? "text-ink" : "text-ink-soft hover:text-ink"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-soft">
          <ThemeToggle />
          <span className="hidden sm:inline">{user?.name}</span>
          <button onClick={logout} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink-soft">
            Sign out
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
