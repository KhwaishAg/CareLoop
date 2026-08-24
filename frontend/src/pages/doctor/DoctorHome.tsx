import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useMyAppointments } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { AIBadge } from "../../components/AIBadge";

const URGENCY_TONE = { LOW: "positive", MEDIUM: "warning", HIGH: "critical" } as const;

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function DoctorHome() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useMyAppointments();

  const upcoming = (appointments ?? [])
    .filter((a) => a.status === "BOOKED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const today = upcoming.filter((a) => isToday(a.startTime));
  const later = upcoming.filter((a) => !isToday(a.startTime));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Today's schedule</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Good to see you, Dr. {user?.name.split(" ").pop()}.
      </h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      <section className="mb-12">
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">
          Today · {today.length} patient{today.length === 1 ? "" : "s"}
        </p>
        {today.length === 0 && !isLoading && <p className="text-ink-soft">Nothing on the books today.</p>}
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {today.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 py-4 transition hover:pl-2">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-sm text-ink-soft">
                  {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="font-display text-lg font-semibold text-ink">{a.patient.name}</span>
                <Link
                  to={`/doctor/patients/${a.patient.id}`}
                  className="text-xs text-ink-soft underline underline-offset-2 hover:text-accent"
                >
                  history
                </Link>
              </div>
              <Link to={`/doctor/appointments/${a.id}`} className="flex items-center gap-3">
                {a.symptomForm?.safetySignalFlagged && <StatusPill label="Flagged" tone="critical" />}
                {a.symptomForm?.status === "READY" && a.symptomForm.urgency && (
                  <StatusPill label={a.symptomForm.urgency} tone={URGENCY_TONE[a.symptomForm.urgency]} />
                )}
                {a.symptomForm?.status === "READY" && <AIBadge text="BRIEF READY" />}
                {a.symptomForm?.status === "PENDING" && (
                  <span className="text-xs text-ink-soft">Preparing brief…</span>
                )}
                <span className="text-ink-soft">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {later.length > 0 && (
        <section>
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Upcoming</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {later.map((a) => (
              <li key={a.id}>
                <Link to={`/doctor/appointments/${a.id}`} className="flex items-center justify-between gap-4 py-4 transition hover:pl-2">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-sm text-ink-soft">
                      {new Date(a.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                    <span className="font-display text-lg font-semibold text-ink">{a.patient.name}</span>
                  </div>
                  <span className="text-ink-soft">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
