import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useMyAppointments } from "../../lib/hooks";
import { HealthTimeline } from "../../components/HealthTimeline";
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

  const pendingHolds = (appointments ?? []).filter(
    (a) => a.status === "HELD" && a.holdExpiresAt && new Date(a.holdExpiresAt).getTime() > now
  );

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

  const activeMedications = (appointments ?? [])
    .flatMap((a) => a.medications)
    .filter((m) => new Date(m.endDate).getTime() >= new Date().setHours(0, 0, 0, 0));

  // "What do I need to do today?" — a short, ordered checklist rather than
  // a stats row. Each step either has an action attached or is settled.
  const steps: { label: string; done: boolean; action?: { to: string; label: string } }[] = [];
  if (next) {
    steps.push({
      label: "Symptom form submitted",
      done: true,
    });
    steps.push({
      label: "AI pre-visit summary ready for your doctor",
      done: next.symptomForm?.status === "READY",
    });
  }
  if (activeMedications.length > 0) {
    steps.push({
      label: `${activeMedications.length} medication${activeMedications.length === 1 ? "" : "s"} to keep up with`,
      done: false,
      action: { to: "/medications", label: "View" },
    });
  }
  followUpsNeeded.forEach((a) => {
    steps.push({
      label: `Follow-up with ${doctorLabel(a.doctor.name)} — around ${new Date(
        a.recommendedFollowUpDate!
      ).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`,
      done: false,
      action: { to: "/book", label: "Book" },
    });
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">
        {greeting()}, {user?.name.split(" ")[0]}
      </p>
      <h1 className="mb-12 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Your care, at a glance.
      </h1>

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

      {/* NEXT APPOINTMENT — the one thing this page exists to answer */}
      <section className="mb-14">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Next appointment</p>
        {next ? (
          <div className="rounded-xl border border-line bg-bg-raised p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="font-display text-2xl font-semibold text-ink">{doctorLabel(next.doctor.name)}</p>
                {next.doctor.doctorProfile && (
                  <p className="text-ink-soft">{next.doctor.doctorProfile.specialisation}</p>
                )}
                <p className="mt-3 text-lg text-ink">
                  {new Date(next.startTime).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {new Date(next.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Confirmed · Calendar synced
                </p>
              </div>
              <Link
                to={`/appointments/${next.id}`}
                className="whitespace-nowrap rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent"
              >
                View appointment →
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-bg-raised px-6 py-6">
            <p className="text-ink-soft">No upcoming appointments.</p>
            <Link to="/book" className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Find a doctor
            </Link>
          </div>
        )}
      </section>

      {/* YOUR NEXT STEPS — a checklist, not stat tiles */}
      {steps.length > 0 && (
        <section className="mb-14">
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Your next steps</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs ${
                      s.done ? "border-success bg-success text-white" : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={s.done ? "text-ink-soft line-through" : "text-ink"}>{s.label}</span>
                </div>
                {!s.done && s.action && (
                  <Link to={s.action.to} className="whitespace-nowrap text-sm text-accent hover:underline">
                    {s.action.label} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* RECENT CARE — a taste of the timeline, not the whole thing */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Recent care</p>
          <Link to="/timeline" className="text-sm text-accent hover:underline">
            Full timeline →
          </Link>
        </div>
        {isLoading ? (
          <p className="text-ink-soft">Loading…</p>
        ) : (
          <HealthTimeline appointments={appointments ?? []} compact />
        )}
      </section>
    </div>
  );
}
