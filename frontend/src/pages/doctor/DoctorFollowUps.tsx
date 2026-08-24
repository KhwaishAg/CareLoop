import { Link } from "react-router-dom";
import { useFollowUpRollup } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";

const TONE = { OVERDUE: "critical", DUE_SOON: "warning", ON_TRACK: "positive" } as const;
const LABEL = { OVERDUE: "Overdue", DUE_SOON: "Due soon", ON_TRACK: "On track" } as const;

export function DoctorFollowUps() {
  const { data: rollup, isLoading } = useFollowUpRollup();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Follow-up tracking</p>
      <h1 className="mb-3 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Who needs to come back in.
      </h1>
      <p className="mb-10 text-ink-soft">
        Patients whose recommended follow-up date has no appointment booked yet, ordered so overdue patients
        surface first. Purely deterministic — no AI involved here.
      </p>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {rollup?.length === 0 && <p className="text-ink-soft">Nothing pending — every follow-up is on track or scheduled.</p>}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {rollup?.map((entry) => (
          <li key={entry.appointment.id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{entry.appointment.patient.name}</p>
              <p className="text-sm text-ink-soft">
                Follow-up recommended for{" "}
                {entry.recommendedFollowUpDate &&
                  new Date(entry.recommendedFollowUpDate).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill label={LABEL[entry.status as keyof typeof LABEL]} tone={TONE[entry.status as keyof typeof TONE]} />
              <Link
                to={`/doctor/appointments/${entry.appointment.id}`}
                className="text-sm text-ink-soft hover:text-accent"
              >
                View visit →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
