import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "HI", label: "हिन्दी" },
  { code: "TA", label: "தமிழ்" },
  { code: "TE", label: "తెలుగు" },
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", preferredLanguage: "EN" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ ...form, role: "PATIENT" });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Couldn't create your account — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-8 py-16 md:px-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs uppercase tracking-widest text-ink-soft hover:text-accent">
            CareLoop
          </Link>
          <ThemeToggle />
        </div>
        <h2 className="mb-8 font-display text-3xl font-semibold text-ink">Create your account</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Full name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Preferred language</span>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  type="button"
                  key={lang.code}
                  onClick={() => setForm({ ...form, preferredLanguage: lang.code })}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    form.preferredLanguage === lang.code
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink-soft hover:border-ink-soft"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="text-accent underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
