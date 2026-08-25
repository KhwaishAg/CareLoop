import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMyAppointments } from "../../lib/hooks";

interface PrescriptionRow {
  id: string;
  medicationName: string;
  dosage: string;
  frequencyType: string;
  instructions: string | null;
  startDate: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
}

export function DoctorPrescriptions() {
  const { data: appointments, isLoading } = useMyAppointments();
  const [query, setQuery] = useState("");

  const rows = useMemo<PrescriptionRow[]>(() => {
    const list: PrescriptionRow[] = [];
    for (const a of appointments ?? []) {
      for (const m of a.medications) {
        list.push({
          id: m.id,
          medicationName: m.name,
          dosage: m.dosage,
          frequencyType: m.frequencyType,
          instructions: m.instructions,
          startDate: m.startDate,
          patientId: a.patient.id,
          patientName: a.patient.name,
          appointmentId: a.id,
        });
      }
    }
    return list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [appointments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.medicationName.toLowerCase().includes(q) || r.patientName.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Your practice</p>
      <h1 className="mb-3 font-display text-4xl font-semibold text-ink">Prescriptions.</h1>
      <p className="mb-8 text-ink-soft">
        Every medicine you've prescribed, most recent first — {rows.length} total.
      </p>

      {rows.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by medicine or patient name…"
          className="mb-8 w-full max-w-sm rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      )}

      {isLoading && <p className="text-ink-soft">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-ink-soft">You haven't prescribed anything yet.</p>
      )}
      {!isLoading && rows.length > 0 && visible.length === 0 && (
        <p className="text-ink-soft">No prescriptions match "{query}".</p>
      )}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {visible.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-ink">
                {r.medicationName} <span className="font-normal text-ink-soft">· {r.dosage}</span>
              </p>
              <p className="text-sm text-ink-soft">{r.frequencyType.replace(/_/g, " ").toLowerCase()}</p>
              {r.instructions && <p className="mt-1 text-sm text-ink-soft">{r.instructions}</p>}
            </div>
            <div className="flex-none text-right">
              <Link to={`/doctor/patients/${r.patientId}`} className="text-sm text-ink hover:text-accent">
                {r.patientName}
              </Link>
              <p className="text-xs text-ink-soft">
                {new Date(r.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
