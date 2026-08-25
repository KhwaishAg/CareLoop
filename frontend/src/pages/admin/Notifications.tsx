import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminNotifications } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";

const STATUS_TONE = { PENDING: "neutral", SENT: "positive", FAILED: "critical" } as const;
const FILTERS = ["ALL", "PENDING", "SENT", "FAILED"] as const;

export function AdminNotifications() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  // Fetch the full set once so filter chips can show live counts without a
  // re-fetch per click; filtering happens client-side.
  const { data: all, isLoading } = useAdminNotifications();

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all?.length ?? 0 };
    for (const s of ["PENDING", "SENT", "FAILED"]) c[s] = (all ?? []).filter((n) => n.status === s).length;
    return c;
  }, [all]);

  const notifications = useMemo(
    () => (all ?? []).filter((n) => filter === "ALL" || n.status === filter),
    [all, filter]
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/admin" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Overview
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Delivery health</p>
      <h1 className="mb-3 font-display text-4xl font-semibold text-ink">Notifications</h1>
      <p className="mb-8 text-ink-soft">
        Every email is a database row before it's ever sent, so failures are visible here rather than silently
        lost.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              filter === f
                ? f === "FAILED"
                  ? "border-critical bg-critical-soft text-critical"
                  : "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-soft hover:border-ink-soft"
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()} · {counts[f] ?? 0}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {!isLoading && notifications.length === 0 && (
        <p className="text-ink-soft">No notifications match this filter.</p>
      )}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {notifications.map((n) => (
          <li key={n.id} className="py-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-ink">
                {n.type.replace(/_/g, " ").toLowerCase()} <span className="text-ink-soft">· {n.channel.toLowerCase()}</span>
              </p>
              <StatusPill label={n.status} tone={STATUS_TONE[n.status]} />
            </div>
            <p className="text-sm text-ink-soft">
              {n.user.name} ({n.user.email}) · {n.attempts} attempt{n.attempts === 1 ? "" : "s"} ·{" "}
              {new Date(n.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            {n.status === "FAILED" && n.lastError && (
              <p className="mt-1 text-sm text-critical">{n.lastError}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
