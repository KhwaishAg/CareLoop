import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useMyAppointments, type Appointment } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";

const URGENCY_TONE = { LOW: "positive", MEDIUM: "warning", HIGH: "critical" } as const;

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** What the doctor needs to know about readiness at a glance, reduced to
 *  ONE state per appointment rather than a stack of badges. */
function readiness(a: Appointment): { label: string; tone: "critical" | "warning" | "positive" | "neutral" } {
  if (a.symptomForm?.safetySignalFlagged) return { label: "Flagged", tone: "critical" };
  if (!a.symptomForm) return { label: "Awaiting symptoms", tone: "neutral" };
  if (a.symptomForm.status === "PENDING") return { label: "Preparing brief…", tone: "neutral" };
  if (a.symptomForm.status === "FAILED") return { label: "Needs review", tone: "warning" };
  if (a.symptomForm.status === "READY" && a.symptomForm.urgency) {
    return { label: `${a.symptomForm.urgency} urgency`, tone: URGENCY_TONE[a.symptomForm.urgency] };
  }
  return { label: "Brief ready", tone: "positive" };
}

export function DoctorHome() {
  const { user } = useAuth();
  const { data: appointments, isLoading } = useMyAppointments();

  const all = appointments ?? [];
  const upcoming = all.filter((a) => a.status === "BOOKED").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const today = upcoming.filter((a) => isToday(a.startTime));
  const later = upcoming.filter((a) => !isToday(a.startTime));

  function isNewPatient(a: Appointment) {
    return !all.some(
      (o) => o.patient.id === a.patient.id && o.status === "COMPLETED" && new Date(o.startTime) < new Date(a.startTime)
    );
  }

  function Row({ a, showDate }: { a: Appointment; showDate?: boolean }) {
    const r = readiness(a);
    return (
      <Link
        to={`/doctor/appointments/${a.id}`}
        className="flex items-center justify-between gap-4 py-4 transition hover:bg-bg-raised"
      >
        <div className="flex items-baseline gap-4">
          <span className="w-16 flex-none font-mono text-sm text-ink-soft">
            {showDate
              ? new Date(a.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
              : new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
          </span>
          <div>
            <span className="font-display text-lg font-semibold text-ink">{a.patient.name}</span>
            <span className="ml-2 text-sm text-ink-soft">{isNewPatient(a) ? "New patient" : "Follow-up"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill label={r.label} tone={r.tone} />
          <span className="text-ink-soft">→</span>
        </div>
      </Link>
    );
  }

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
        {today.length === 0 && !isLoading && (
          <div className="rounded-lg border border-line bg-bg-raised px-4 py-4 text-sm text-ink-soft">
            <p className="mb-1 text-ink">Your schedule is clear today.</p>
            <p>Enjoy the breathing room — we'll let you know when something needs your attention.</p>
          </div>
        )}
        {today.length > 0 && (
          <div className="flex flex-col divide-y divide-line border-y border-line">
            {today.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      {later.length > 0 && (
        <section>
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Upcoming</p>
          <div className="flex flex-col divide-y divide-line border-y border-line">
            {later.map((a) => (
              <Row key={a.id} a={a} showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
