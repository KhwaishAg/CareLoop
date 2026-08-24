import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useMyAppointments } from "../../lib/hooks";
import { PatientJourney } from "../../components/PatientJourney";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function PatientHome() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useMyAppointments();

  const now = Date.now();
  const next = appointments
    ?.filter((a) => a.status === "BOOKED" && new Date(a.startTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  // A HELD row the patient hasn't confirmed yet — most commonly a waitlist
  // offer (a slot freed up and was reserved for them), occasionally an
  // abandoned booking. Easy to miss otherwise since it's neither "next"
  // nor shown on the timeline.
  const pendingHolds = (appointments ?? []).filter(
    (a) => a.status === "HELD" && a.holdExpiresAt && new Date(a.holdExpiresAt).getTime() > now
  );

  // A completed visit where the doctor recommended a follow-up, and the
  // patient hasn't booked (or already had) a later appointment with that
  // same doctor yet. Nothing books this automatically — the patient has to
  // go through Book — so it's surfaced here as a nudge rather than left to
  // be discovered on the old appointment's detail page.
  const followUpsNeeded = (appointments ?? [])
    .filter((a) => a.status === "COMPLETED" && a.recommendedFollowUpDate)
    .filter((a) => {
      const alreadyBookedLater = (appointments ?? []).some(
        (b) =>
          b.doctor.id === a.doctor.id &&
          (b.status === "BOOKED" || b.status === "COMPLETED") &&
          new Date(b.startTime).getTime() > new Date(a.startTime).getTime()
      );
      return !alreadyBookedLater;
    });

  const daysUntil = next
    ? Math.max(0, Math.ceil((new Date(next.startTime).getTime() - now) / 86_400_000))
    : null;

  const todo: { label: string; done: boolean }[] = next
    ? [
        { label: "Symptom form submitted", done: true },
        {
          label: "AI pre-visit summary ready",
          done: next.symptomForm?.status === "READY",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">
        {greeting()}, {user?.name.split(" ")[0]}
      </p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Your care, in one place.
      </h1>

      {followUpsNeeded.length > 0 && (
        <section className="mb-8 flex flex-col gap-3">
          {followUpsNeeded.map((appt) => (
            <div
              key={appt.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-line bg-bg-raised px-4 py-3"
            >
              <p className="text-sm text-ink">
                <span className="font-medium">Follow-up recommended</span> by {doctorLabel(appt.doctor.name)} —
                around{" "}
                {new Date(appt.recommendedFollowUpDate!).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                })}
                . Book a new slot with them whenever you're ready.
              </p>
              <Link
                to="/book"
                className="whitespace-nowrap rounded-lg border border-line px-3.5 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
              >
                Book follow-up →
              </Link>
            </div>
          ))}
        </section>
      )}

      {pendingHolds.length > 0 && (
        <section className="mb-8 flex flex-col gap-3">
          {pendingHolds.map((hold) => (
            <div
              key={hold.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-amber bg-amber-soft px-4 py-3"
            >
              <p className="text-sm text-ink">
                <span className="font-medium">A slot is being held for you</span> — {doctorLabel(hold.doctor.name)},{" "}
                {new Date(hold.startTime).toLocaleString("en-IN", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                . Confirm before the hold expires.
              </p>
              <Link
                to={`/appointments/${hold.id}`}
                className="whitespace-nowrap rounded-lg bg-amber px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Confirm now →
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* Next appointment — large, editorial, not a card grid */}
      <section className="mb-14 border-b border-line pb-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Next appointment</p>
        {next ? (
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-display text-5xl font-semibold text-ink">
                {new Date(next.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 font-mono text-sm uppercase tracking-wide text-ink-soft">
                {new Date(next.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
              </p>
              <p className="mt-4 text-lg text-ink">{doctorLabel(next.doctor.name)}</p>
              <p className="text-ink-soft">
                {daysUntil === 0 ? "Today" : `${daysUntil} day${daysUntil === 1 ? "" : "s"} from now`}
              </p>
            </div>
            <Link
              to={`/appointments/${next.id}`}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent"
            >
              View appointment →
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-ink-soft">Nothing booked yet.</p>
            <Link to="/book" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Book an appointment
            </Link>
          </div>
        )}

        {todo.length > 0 && (
          <ul className="mt-6 flex flex-col gap-1.5">
            {todo.map((t) => (
              <li key={t.label} className="flex items-center gap-2 text-sm">
                <StatusPill label={t.done ? "Done" : "Pending"} tone={t.done ? "positive" : "neutral"} />
                <span className={t.done ? "text-ink-soft line-through" : "text-ink"}>{t.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The signature timeline */}
      <section>
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Your journey</p>
        {isLoading ? (
          <p className="text-ink-soft">Loading…</p>
        ) : (
          <PatientJourney appointments={appointments ?? []} />
        )}
      </section>
    </div>
  );
}
