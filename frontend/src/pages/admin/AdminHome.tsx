import { Link } from "react-router-dom";
import { useDoctors, useFollowUpRollup, useAdminWaitlist, useAdminNotifications } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const TONE = { OVERDUE: "critical", DUE_SOON: "warning", ON_TRACK: "positive" } as const;
const LABEL = { OVERDUE: "Overdue", DUE_SOON: "Due soon", ON_TRACK: "On track" } as const;

export function AdminHome() {
  const { data: doctors } = useDoctors();
  const { data: rollup, isLoading } = useFollowUpRollup();
  const { data: waitlist } = useAdminWaitlist();
  const { data: failedNotifications } = useAdminNotifications("FAILED");

  const overdue = rollup?.filter((r) => r.status === "OVERDUE").length ?? 0;
  const dueSoon = rollup?.filter((r) => r.status === "DUE_SOON").length ?? 0;
  const waiting = waitlist?.filter((w) => w.status === "WAITING").length ?? 0;
  const failedCount = failedNotifications?.length ?? 0;

  // Real operational issues, not a metrics wall — this is what an admin
  // actually needs to act on today, ranked most urgent first.
  const attention: { key: string; text: string; tone: "critical" | "warning" }[] = [];
  if (overdue > 0) {
    attention.push({
      key: "overdue",
      text: `${overdue} follow-up${overdue === 1 ? " is" : "s are"} overdue.`,
      tone: "critical",
    });
  }
  if (failedCount > 0) {
    attention.push({
      key: "failed",
      text: `${failedCount} notification${failedCount === 1 ? " delivery has" : " deliveries have"} failed.`,
      tone: "critical",
    });
  }
  if (dueSoon > 0) {
    attention.push({ key: "due-soon", text: `${dueSoon} follow-up${dueSoon === 1 ? " is" : "s are"} due soon.`, tone: "warning" });
  }
  if (waiting > 0) {
    attention.push({
      key: "waiting",
      text: `${waiting} patient${waiting === 1 ? " is" : "s are"} waiting for a released slot.`,
      tone: "warning",
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Clinic operations</p>
      <h1 className="mb-10 font-display text-4xl font-semibold text-ink">Operations room</h1>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Doctors</p>
          <p className="font-display text-3xl font-semibold text-ink">{doctors?.length ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Follow-ups due</p>
          <p className="font-display text-3xl font-semibold text-ink">{overdue + dueSoon}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">On waitlist</p>
          <p className="font-display text-3xl font-semibold text-ink">{waiting}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-raised p-5">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Failed deliveries</p>
          <p className={`font-display text-3xl font-semibold ${failedCount > 0 ? "text-critical" : "text-ink"}`}>
            {failedCount}
          </p>
        </div>
      </div>

      <section className="mb-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Attention</p>
        {isLoading ? (
          <p className="text-ink-soft">Loading…</p>
        ) : attention.length === 0 ? (
          <div className="rounded-lg border border-line bg-bg-raised px-4 py-4 text-sm">
            <p className="mb-1 text-ink">Everything looks good.</p>
            <p className="text-ink-soft">No clinic issues need your attention right now.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li
                key={a.key}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  a.tone === "critical"
                    ? "border-critical bg-critical-soft text-critical"
                    : "border-amber bg-amber-soft text-amber"
                }`}
              >
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-6 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Doctors</p>
        <Link to="/admin/doctors" className="text-sm text-accent hover:underline">
          Manage doctors →
        </Link>
      </div>

      <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Follow-ups needing attention</p>
      {rollup?.length === 0 && !isLoading && <p className="text-ink-soft">Nothing pending clinic-wide.</p>}
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
