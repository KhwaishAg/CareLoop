import { Link, Navigate } from "react-router-dom";
import { useAuth, roleHomePath } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";

const AUDIENCES = [
  {
    tag: "For patients",
    heading: "Book in three steps, not three phone calls.",
    points: [
      "Pick a doctor, a time, and tell us what's wrong — done in under a minute.",
      "An AI-prepared brief gets your doctor up to speed before you walk in.",
      "A running timeline of every visit, what changed, and what's next.",
    ],
  },
  {
    tag: "For doctors",
    heading: "Walk in already knowing what changed.",
    points: [
      "Each patient's brief flags urgency and what's new since their last visit.",
      "One place to close the loop: notes, prescriptions, and follow-up dates.",
      "Follow-ups that are overdue surface themselves — nobody has to remember.",
    ],
  },
  {
    tag: "For clinics",
    heading: "Run the operation, not just the calendar.",
    points: [
      "See exactly who's affected before you approve a doctor's leave day.",
      "A waitlist that offers freed slots automatically, earliest request first.",
      "Delivery health for every notification — nothing fails silently.",
    ],
  },
];

const STEPS = [
  { n: "01", title: "Choose a doctor", body: "Browse by specialisation and pick who you want to see." },
  { n: "02", title: "Pick a time", body: "Real-time availability, held for you while you finish booking." },
  { n: "03", title: "Tell us what's wrong", body: "In your language, typed or spoken — your doctor sees it before you arrive." },
];

export function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to={roleHomePath(user.role)} replace />;

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-line px-6 py-4 md:px-10">
        <span className="font-mono text-sm uppercase tracking-widest text-accent">CareLoop</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm text-ink-soft transition hover:text-ink">
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-20 text-center md:px-10 md:pt-28">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
          Appointments · AI briefs · Follow-up, remembered
        </p>
        <h1 className="mx-auto mb-6 max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.08] text-ink md:text-6xl">
          Healthcare that keeps up with you.
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-ink-soft">
          CareLoop connects patients, doctors, and clinic staff around one thread per patient — booking, an
          AI-prepared brief, the visit itself, and what happens after.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            Book your first visit
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-line px-6 py-3 font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-bg-raised px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
            How booking works
          </p>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="mb-2 font-display text-3xl font-semibold text-accent">{s.n}</p>
                <p className="mb-1.5 font-display text-xl font-semibold text-ink">{s.title}</p>
                <p className="text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10">
        <div className="flex flex-col divide-y divide-line">
          {AUDIENCES.map((a) => (
            <div key={a.tag} className="grid grid-cols-1 gap-6 py-12 md:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">{a.tag}</p>
                <p className="text-balance font-display text-3xl font-semibold leading-tight text-ink">
                  {a.heading}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-3 text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line px-6 py-20 text-center md:px-10">
        <p className="mx-auto mb-8 max-w-md text-balance font-display text-3xl font-semibold leading-tight text-ink">
          Your next visit starts here.
        </p>
        <Link
          to="/register"
          className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
        >
          Create your account
        </Link>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-soft md:px-10">
        CareLoop — appointment scheduling, follow-up tracking, and AI-assisted visit summaries.
      </footer>
    </div>
  );
}
