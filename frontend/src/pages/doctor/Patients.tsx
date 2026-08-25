import { Link } from "react-router-dom";
import { useMyAppointments } from "../../lib/hooks";

/** Every distinct patient this doctor has ever seen or has booked, most
 *  recently active first — derived from the doctor's own appointment list
 *  rather than a new endpoint, since that data already carries everything
 *  needed here. */
export function DoctorPatients() {
  const { data: appointments, isLoading } = useMyAppointments();

  const byPatient = new Map<string, { id: string; name: string; lastVisit: string; visitCount: number }>();
  for (const appt of appointments ?? []) {
    const existing = byPatient.get(appt.patient.id);
    if (!existing || new Date(appt.startTime) > new Date(existing.lastVisit)) {
      byPatient.set(appt.patient.id, {
        id: appt.patient.id,
        name: appt.patient.name,
        lastVisit: appt.startTime,
        visitCount: (existing?.visitCount ?? 0) + 1,
      });
    } else {
      existing.visitCount += 1;
    }
  }
  const patients = [...byPatient.values()].sort(
    (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Patients</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Everyone under your care.
      </h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {!isLoading && patients.length === 0 && (
        <p className="text-ink-soft">No patients yet — they'll show up here once appointments come in.</p>
      )}

      {!isLoading && patients.length > 0 && (
        <div className="border-t border-line">
          {patients.map((p) => (
            <Link
              key={p.id}
              to={`/doctor/patients/${p.id}`}
              className="flex items-center justify-between gap-4 border-b border-line py-4 transition hover:bg-bg-raised"
            >
              <div>
                <p className="font-medium text-ink">{p.name}</p>
                <p className="text-sm text-ink-soft">
                  {p.visitCount} visit{p.visitCount === 1 ? "" : "s"} · last{" "}
                  {new Date(p.lastVisit).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <span className="text-ink-soft">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
