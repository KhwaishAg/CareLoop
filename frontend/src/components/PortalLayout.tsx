import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { to: string; label: string; shortLabel?: string; end?: boolean; icon: string };

const NAV: Record<string, NavItem[]> = {
  PATIENT: [
    { to: "/dashboard", label: "Home", end: true, icon: "home" },
    { to: "/book", label: "Find a Doctor", shortLabel: "Doctors", icon: "search" },
    { to: "/appointments", label: "Appointments", shortLabel: "Visits", icon: "calendar" },
    { to: "/timeline", label: "Health Timeline", shortLabel: "Timeline", icon: "clock" },
    { to: "/medications", label: "Medications", shortLabel: "Meds", icon: "pill" },
    { to: "/waitlist", label: "Waitlist", icon: "list" },
  ],
  DOCTOR: [
    { to: "/doctor", label: "Today", end: true, icon: "home" },
    { to: "/doctor/patients", label: "Patients", icon: "search" },
    { to: "/doctor/calendar", label: "Calendar", icon: "calendar" },
    { to: "/doctor/prescriptions", label: "Prescriptions", shortLabel: "Rx", icon: "pill" },
    { to: "/doctor/follow-ups", label: "Follow-ups", shortLabel: "Follow-ups", icon: "clock" },
    { to: "/doctor/settings", label: "Settings", icon: "list" },
  ],
  ADMIN: [
    { to: "/admin", label: "Overview", end: true, icon: "home" },
    { to: "/admin/doctors", label: "Doctors", icon: "search" },
    { to: "/admin/waitlist", label: "Waitlist", icon: "list" },
    { to: "/admin/notifications", label: "Notifications", shortLabel: "Alerts", icon: "calendar" },
  ],
};

/** The bottom tab bar is capped to what fits comfortably on a phone —
 *  for the patient portal (6 items) this drops the least time-critical
 *  one (Waitlist, still reachable from the desktop nav and from booking's
 *  "no slots" prompt) rather than cramming in a 6th tab. */
const MOBILE_NAV_LIMIT = 5;

const ICON_PATHS: Record<string, string> = {
  home: "M3 10.5 12 4l9 6.5M5.5 9.5V19a1 1 0 0 0 1 1h4v-5h3v5h4a1 1 0 0 0 1-1V9.5",
  search: "M9.5 15a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11ZM17.5 17.5 13.6 13.6",
  calendar: "M4.5 5.5h15v14h-15v-14ZM4.5 9.5h15M8 3.5v3M16 3.5v3",
  clock: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v4l3 2",
  pill: "m6.5 17.5 7-7a3.5 3.5 0 1 1 5 5l-7 7a3.5 3.5 0 1 1-5-5ZM9.5 10.5l4 4",
  list: "M8 6.5h11M8 12h11M8 17.5h11M4 6.5h.01M4 12h.01M4 17.5h.01",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function PortalLayout({ homePath }: { homePath: string }) {
  const { user, logout } = useAuth();
  const nav = user ? NAV[user.role] ?? [] : [];
  const mobileNav = nav.slice(0, MOBILE_NAV_LIMIT);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link to={homePath} className="font-mono text-sm uppercase tracking-widest text-accent">
            CareLoop
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
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
        <div className="flex items-center gap-3 text-sm text-ink-soft sm:gap-4">
          <ThemeToggle />
          <Link
            to="/profile"
            className="hidden items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 transition hover:border-accent hover:text-accent sm:flex"
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {user ? initials(user.name) : ""}
            </span>
            {user?.name}
          </Link>
          <button
            onClick={logout}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs hover:border-ink-soft sm:px-3 sm:text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Bottom tab bar — mobile only. Content gets bottom padding so the
         last section of every page isn't hidden behind it. */}
      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t border-line bg-bg-raised md:hidden">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] transition ${
                isActive ? "text-accent" : "text-ink-soft"
              }`
            }
          >
            <NavIcon name={item.icon} />
            <span className="leading-none">{item.shortLabel ?? item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
