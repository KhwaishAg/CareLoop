import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, roleHomePath } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";

const HIGHLIGHTS = [
  {
    label: "AI-prepared briefs",
    body: "A clinical summary ready before you walk in.",
    icon: "M11 3v3M11 15v3M3 11h3M15 11h3M5.5 5.5l2 2M14.5 14.5l2 2M16.5 5.5l-2 2M7.5 14.5l-2 2",
  },
  {
    label: "Follow-ups tracked",
    body: "Overdue follow-ups surface themselves — automatically.",
    icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM11 8v3.5l2.5 1.5",
  },
  {
    label: "Speak in your language",
    body: "Type or talk — English, हिन्दी, தமிழ், or తెలుగు.",
    icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM4 11h14M11 4c1.8 1.9 2.8 4.4 2.8 7s-1 5.1-2.8 7c-1.8-1.9-2.8-4.4-2.8-7s1-5.1 2.8-7Z",
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(roleHomePath(user.role), { replace: true });
    } catch {
      setError("That email and password don't match — check and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Theme toggle lives at the true corner of the page, not inside the
         constrained form column — same for every page, not tied to either
         panel's layout. */}
      <div className="fixed right-5 top-5 z-30 md:right-8 md:top-8">
        <ThemeToggle />
      </div>

      {/* Both panels are top-aligned with the same offset (not vertically
         centered independently) so the CareLoop mark lines up with "Sign
         in", and the content below is sized to end around the same place
         as the demo-accounts box on the right. */}
      <div className="hidden flex-col bg-accent-soft px-16 pt-24 md:flex md:pt-28">
        <Link
          to="/"
          className="mb-9 inline-flex w-fit items-center gap-2.5 transition hover:opacity-80"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-display text-base font-semibold text-white">
            C
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-ink">CareLoop</span>
        </Link>

        <h1 className="max-w-md text-balance font-display text-5xl font-semibold leading-[1.05] text-ink">
          Your care,
          <br />
          over time.
        </h1>
        <p className="mt-6 max-w-sm text-ink-soft">
          Every visit remembers the one before it — symptoms, medication, what's changed. For
          patients, doctors, and the clinic running it all.
        </p>

        <div className="mt-9 flex max-w-sm flex-col gap-5">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-bg-raised text-accent">
                <svg viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={h.icon} />
                </svg>
              </span>
              <div>
                <p className="font-medium text-ink">{h.label}</p>
                <p className="text-sm text-ink-soft">{h.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col px-8 pt-24 md:px-16 md:pt-28">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-6 inline-block font-mono text-xs uppercase tracking-widest text-ink-soft transition hover:text-accent md:hidden"
          >
            ← CareLoop
          </Link>
          <h2 className="mb-8 font-display text-3xl font-semibold text-ink">Sign in</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="text-sm text-critical">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            New patient?{" "}
            <Link to="/register" className="text-accent underline underline-offset-2">
              Create an account
            </Link>
          </p>

          <div className="mt-10 rounded-lg border border-line bg-bg-raised px-4 py-3 text-xs text-ink-soft">
            <p className="mb-1 font-mono uppercase tracking-wide">Demo accounts</p>
            <p>patient@demo.com · dr.sharma@clinic.demo · admin@clinic.demo</p>
            <p>Password123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
