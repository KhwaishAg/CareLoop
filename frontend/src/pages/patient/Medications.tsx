import { useMyAppointments } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

function isActive(endDate: string) {
  return new Date(endDate).getTime() >= new Date().setHours(0, 0, 0, 0);
}

export function MedicationsPage() {
  const { data: appointments, isLoading } = useMyAppointments();

  const all = (appointments ?? [])
    .flatMap((a) => a.medications.map((m) => ({ ...m, doctorName: a.doctor.name })))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const active = all.filter((m) => isActive(m.endDate));
  const past = all.filter((m) => !isActive(m.endDate));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Medications</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Everything you're taking.
      </h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      <section className="mb-12">
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Active</p>
        {!isLoading && all.length === 0 && (
          <div className="rounded-lg border border-line bg-bg-raised px-4 py-4 text-sm text-ink-soft">
            Nothing here yet — this page fills in automatically once a doctor completes a visit and prescribes
            something. After your appointment, come back here to see the medication and reminder schedule.
          </div>
        )}
        {!isLoading && all.length > 0 && active.length === 0 && (
          <p className="text-ink-soft">No active prescriptions right now.</p>
        )}
        <ul className="flex flex-col gap-3">
          {active.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-bg-raised p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-ink">{m.name}</p>
                <StatusPill label="Active" tone="positive" />
              </div>
              <p className="text-sm text-ink-soft">
                {m.dosage} · {m.frequencyType.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-sm text-ink-soft">
                {new Date(m.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} –{" "}
                {new Date(m.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · prescribed
                by {doctorLabel(m.doctorName)}
              </p>
              {m.instructions && <p className="mt-1 text-sm text-ink">{m.instructions}</p>}
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section>
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Past</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {past.map((m) => (
              <li key={m.id} className="py-3">
                <p className="text-ink">{m.name}</p>
                <p className="text-sm text-ink-soft">
                  {m.dosage} · ended{" "}
                  {new Date(m.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
