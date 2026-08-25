import { useMyAppointments } from "../../lib/hooks";
import { HealthTimeline } from "../../components/HealthTimeline";

export function TimelinePage() {
  const { data: appointments, isLoading } = useMyAppointments();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Health timeline</p>
      <h1 className="mb-2 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Your care, over time.
      </h1>
      <p className="mb-10 text-ink-soft">Every visit, what changed, and what's next — remembered in one place.</p>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {!isLoading && <HealthTimeline appointments={appointments ?? []} />}
    </div>
  );
}
