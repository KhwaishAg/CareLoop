import { useParams, Link } from "react-router-dom";
import { useMyAppointments } from "../../lib/hooks";
import { HealthTimeline } from "../../components/HealthTimeline";

export function PatientTimeline() {
  const { patientId } = useParams();
  const { data: appointments, isLoading } = useMyAppointments();

  const patientAppointments = (appointments ?? []).filter((a) => a.patient.id === patientId);
  const patientName = patientAppointments[0]?.patient.name ?? "Patient";
  const completedCount = patientAppointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/doctor" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Back to today
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Patient history</p>
      <h1 className="mb-2 font-display text-4xl font-semibold text-ink">{patientName}</h1>
      <p className="mb-10 text-ink-soft">
        {completedCount} completed visit{completedCount === 1 ? "" : "s"} with you.
      </p>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      {!isLoading && patientAppointments.length === 0 && (
        <p className="text-ink-soft">No visit history with this patient yet.</p>
      )}

      {patientAppointments.length > 0 && <HealthTimeline appointments={patientAppointments} />}
    </div>
  );
}
