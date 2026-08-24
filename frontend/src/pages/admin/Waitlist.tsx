import { Link } from "react-router-dom";
import { useAdminWaitlist } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const STATUS_TONE = { WAITING: "neutral", OFFERED: "positive", CLAIMED: "positive", EXPIRED: "neutral" } as const;

export function AdminWaitlist() {
  const { data: entries, isLoading } = useAdminWaitlist();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/admin" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Overview
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Clinic-wide</p>
      <h1 className="mb-10 font-display text-4xl font-semibold text-ink">Waitlist</h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {entries?.length === 0 && <p className="text-ink-soft">Nobody's waiting right now.</p>}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {entries?.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-ink">
                {e.patient.name} <span className="text-ink-soft">→ {doctorLabel(e.doctor.name)}</span>
              </p>
              <p className="text-sm text-ink-soft">
                {new Date(e.preferredDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ·{" "}
                {e.preferredStartTime}–{e.preferredEndTime} · joined{" "}
                {new Date(e.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
              </p>
            </div>
            <StatusPill label={e.status} tone={STATUS_TONE[e.status]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
