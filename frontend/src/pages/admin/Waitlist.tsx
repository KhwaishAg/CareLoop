import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminWaitlist, type AdminWaitlistEntry } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const STATUS_TONE = { WAITING: "neutral", OFFERED: "positive", CLAIMED: "positive", EXPIRED: "neutral" } as const;
const STATUSES: AdminWaitlistEntry["status"][] = ["WAITING", "OFFERED", "CLAIMED", "EXPIRED"];

function daysWaiting(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function AdminWaitlist() {
  const { data: entries, isLoading } = useAdminWaitlist();
  const [filter, setFilter] = useState<AdminWaitlistEntry["status"] | "ALL">("WAITING");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: entries?.length ?? 0 };
    for (const s of STATUSES) c[s] = (entries ?? []).filter((e) => e.status === s).length;
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    const list = (entries ?? []).filter((e) => filter === "ALL" || e.status === filter);
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [entries, filter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/admin" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Overview
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Clinic-wide</p>
      <h1 className="mb-10 font-display text-4xl font-semibold text-ink">Waitlist</h1>

      <div className="mb-8 flex flex-wrap gap-2">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              filter === s
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} · {counts[s] ?? 0}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {!isLoading && visible.length === 0 && (
        <p className="text-ink-soft">
          {filter === "WAITING" ? "Nobody's waiting right now." : "Nothing here."}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {visible.map((e) => (
          <li key={e.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-ink">
                {e.patient.name} <span className="text-ink-soft">→ {doctorLabel(e.doctor.name)}</span>
              </p>
              <p className="text-sm text-ink-soft">
                Wants {new Date(e.preferredDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ·{" "}
                {e.preferredStartTime}–{e.preferredEndTime}
                {e.status === "WAITING" && (
                  <> · waiting {daysWaiting(e.createdAt)} day{daysWaiting(e.createdAt) === 1 ? "" : "s"}</>
                )}
              </p>
            </div>
            <StatusPill label={e.status} tone={STATUS_TONE[e.status]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
