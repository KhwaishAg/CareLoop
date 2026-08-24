import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, roleHomePath } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";

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
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="hidden flex-col justify-center bg-accent-soft px-16 md:flex">
        <Link to="/" className="mb-3 font-mono text-xs uppercase tracking-widest text-accent">
          CareLoop
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
      </div>

      <div className="flex flex-col justify-center px-8 py-16 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="font-mono text-xs uppercase tracking-widest text-ink-soft md:hidden">
              CareLoop
            </Link>
            <ThemeToggle />
          </div>
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
