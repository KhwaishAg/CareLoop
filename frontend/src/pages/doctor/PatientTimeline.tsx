import { useParams, Link } from "react-router-dom";
import { useMyAppointments } from "../../lib/hooks";
import { PatientJourney } from "../../components/PatientJourney";

export function PatientTimeline() {
  const { patientId } = useParams();
  const { data: appointments, isLoading } = useMyAppointments();

  const patientAppointments = (appointments ?? []).filter((a) => a.patient.id === patientId);
  const patientName = patientAppointments[0]?.patient.name ?? "Patient";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/doctor" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Back to today
      </Link>

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Patient history</p>
      <h1 className="mb-10 font-display text-4xl font-semibold text-ink">{patientName}</h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      <PatientJourney appointments={patientAppointments} perspective="doctor" />

      {!isLoading && patientAppointments.filter((a) => a.status === "COMPLETED").length > 0 && (
        <section className="mt-12 border-t border-line pt-8">
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Past visits with you</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {patientAppointments
              .filter((a) => a.status === "COMPLETED")
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map((a) => (
                <li key={a.id}>
                  <Link to={`/doctor/appointments/${a.id}`} className="flex items-center justify-between py-4 transition hover:pl-2">
                    <div>
                      <p className="text-ink">
                        {new Date(a.startTime).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-sm text-ink-soft">{a.symptomForm?.chiefComplaint ?? "Consultation"}</p>
                    </div>
                    <span className="text-ink-soft">→</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
