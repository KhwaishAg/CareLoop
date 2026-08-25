import { useEffect, useState } from "react";
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

// The whole product in one line — visually anchors the "continuity of
// care" idea before any section explains it in words.
const JOURNEY = ["Symptoms", "Appointment", "Consultation", "Treatment", "Follow-up", "Next visit"];

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#portals", label: "Portals" },
  { href: "#ai-trust", label: "AI & trust" },
  { href: "#faq", label: "FAQ" },
];

const FAQS = [
  {
    q: "Is the AI actually reading my symptoms, or is it decoration?",
    a: "It's real — every symptom description is sent to an AI model that structures it into a brief for your doctor (urgency, what's new vs. ongoing) and, after your visit, turns clinical notes into a plain-language summary. It always ends with a doctor-reviewed note; it never replaces a clinician's judgment.",
  },
  {
    q: "Can I sign up as a doctor directly?",
    a: "No — doctor accounts are created by a clinic admin, not through public sign-up. This keeps clinical access limited to people the clinic has actually verified. If you're a doctor joining a clinic, ask your admin to add you from Doctors → Add doctor.",
  },
  {
    q: "What happens if my preferred slot is full?",
    a: "Join the waitlist for that doctor and date — if a slot frees up (a cancellation, or a doctor opening more hours), you're offered it automatically, earliest request first, with a short hold to confirm.",
  },
  {
    q: "Does my doctor get notified if I need a follow-up?",
    a: "Yes — recommended follow-up dates are tracked automatically, and both you and your doctor see when one is coming up or overdue, on your Home and Timeline pages.",
  },
  {
    q: "Is my medical data shared with anyone?",
    a: "No. Your visit history, medications, and notes stay tied to your account, visible only to you and the doctors you've actually seen — never sold, never shared with third parties.",
  },
];

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export function LandingPage() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolled();

  if (!loading && user) return <Navigate to={roleHomePath(user.role)} replace />;

  return (
    <div className="min-h-screen bg-bg">
      <header
        className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 backdrop-blur transition-colors md:px-10 lg:px-16 ${
          scrolled ? "border-b border-line bg-bg/90" : "border-b border-transparent bg-bg/60"
        }`}
      >
        <span className="font-mono text-sm uppercase tracking-widest text-accent">CareLoop</span>

        <div className="hidden items-center gap-8 md:flex">
          <nav className="flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-base font-medium text-ink transition hover:text-accent">
                {l.label}
              </a>
            ))}
          </nav>
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

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:border-accent hover:text-accent"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              {menuOpen ? <path d="M5 5l10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="border-b border-line bg-bg px-6 py-4 md:hidden">
          <nav className="mb-4 flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-ink-soft transition hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink transition hover:border-accent hover:text-accent"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center md:px-10 md:pt-28 lg:px-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
          Appointments · AI briefs · Follow-up, remembered
        </p>
        <h1 className="mx-auto mb-6 max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.08] text-ink md:text-6xl">
          Healthcare that remembers what happened before.
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-ink-soft">
          Book appointments, prepare your doctor with AI-assisted symptom summaries, and stay on top of your
          treatment and follow-ups — all in one place.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            Find a Doctor
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-line px-6 py-3 font-medium text-ink transition hover:border-accent hover:text-accent"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* The whole idea, in one strip: continuity of care */}
      <section className="mx-auto max-w-6xl px-6 pb-20 md:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
          {JOURNEY.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-line bg-bg-raised px-3.5 py-1.5 text-sm text-ink-soft">
                {step}
              </span>
              {i < JOURNEY.length - 1 && <span className="text-line">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-bg-raised px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
            How booking works
          </p>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-16">
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

      {/* Audiences / portals */}
      <section id="portals" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 md:px-10 lg:px-16">
        <div className="flex flex-col divide-y divide-line">
          {AUDIENCES.map((a) => (
            <div key={a.tag} className="grid grid-cols-1 gap-6 py-12 md:grid-cols-[1fr_1.4fr] md:gap-14">
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

      {/* AI, multilingual input, and trust — kept quiet and factual, not a features showcase */}
      <section id="ai-trust" className="scroll-mt-20 border-y border-line bg-bg-raised px-6 py-16 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">AI-assisted, not AI-run</p>
            <p className="text-ink-soft">
              Before your visit, your symptoms are organized into a brief your doctor reviews and acts on — it
              never replaces their judgment, and every AI-generated note says so plainly.
            </p>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">Speak, in your language</p>
            <p className="text-ink-soft">
              Describe what's wrong by typing or speaking, in English, हिन्दी, தமிழ், or తెలుగు — whichever's
              easiest in the moment.
            </p>
          </div>
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">Your record, kept safe</p>
            <p className="text-ink-soft">
              Visit history, medications, and notes stay tied to your account, visible only to you and the
              doctors you see — never sold, never shared.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-6 py-20 md:px-10 lg:px-16">
        <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-ink-soft">
          Questions
        </p>
        <div className="flex flex-col divide-y divide-line border-y border-line">
          {FAQS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-medium text-ink">
                {item.q}
                <span className="flex-none text-ink-soft transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line px-6 py-20 text-center md:px-10 lg:px-16">
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

      <footer className="border-t border-line px-6 py-14 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-2 font-mono text-sm uppercase tracking-widest text-accent">CareLoop</p>
            <p className="text-sm text-ink-soft">
              Appointment scheduling, AI-assisted visit summaries, and follow-up tracking — for patients,
              doctors, and clinics.
            </p>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Product</p>
            <ul className="flex flex-col gap-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-ink-soft transition hover:text-ink">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Account</p>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link to="/register" className="text-ink-soft transition hover:text-ink">
                  Create an account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-ink-soft transition hover:text-ink">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Contact</p>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a href="mailto:hello@careloop.demo" className="text-ink-soft transition hover:text-ink">
                  hello@careloop.demo
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-6xl flex-col-reverse items-center justify-between gap-4 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row">
          <p>© {new Date().getFullYear()} CareLoop. Built as a healthcare appointment platform demo.</p>
          <p>Made for patients, doctors, and clinics — not a real clinical product.</p>
        </div>
      </footer>
    </div>
  );
}
