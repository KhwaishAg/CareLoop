import { Link } from "react-router-dom";
import { useDoctors, useFollowUpRollup } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const TONE = { OVERDUE: "critical", DUE_SOON: "warning", ON_TRACK: "positive" } as const;
const LABEL = { OVERDUE: "Overdue", DUE_SOON: "Due soon", ON_TRACK: "On track" } as const;

export function AdminHome() {
  const { data: doctors } = useDoctors();
  const { data: rollup, isLoading } = useFollowUpRollup();

  const overdue = rollup?.filter((r) => r.status === "OVERDUE").length ?? 0;
  const dueSoon = rollup?.filter((r) => r.status === "DUE_SOON").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Clinic operations</p>
      <h1 className="mb-10 font-display text-4xl font-semibold text-ink">Operations room</h1>

      <div className="mb-12 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Doctors</p>
          <p className="font-display text-3xl font-semibold text-ink">{doctors?.length ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Follow-ups overdue</p>
          <p className="font-display text-3xl font-semibold text-critical">{overdue}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Due soon</p>
          <p className="font-display text-3xl font-semibold text-amber">{dueSoon}</p>
        </div>
      </div>

      <div className="mb-12 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Doctors</p>
        <Link to="/admin/doctors" className="text-sm text-accent hover:underline">
          Manage doctors →
        </Link>
      </div>

      <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Follow-ups needing attention</p>
      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {rollup?.length === 0 && <p className="text-ink-soft">Nothing pending clinic-wide.</p>}
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {rollup?.slice(0, 10).map((entry) => (
          <li key={entry.appointment.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-ink">{entry.appointment.patient.name}</p>
              <p className="text-sm text-ink-soft">with {doctorLabel(entry.appointment.doctor.name)}</p>
            </div>
            <StatusPill label={LABEL[entry.status as keyof typeof LABEL]} tone={TONE[entry.status as keyof typeof TONE]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
