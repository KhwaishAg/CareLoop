import { Link } from "react-router-dom";
import { useMyAppointments } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const STATUS_TONE: Record<string, "positive" | "warning" | "critical" | "neutral"> = {
  BOOKED: "positive",
  HELD: "warning",
  COMPLETED: "neutral",
  CANCELLED: "critical",
};

export function PatientAppointmentsList() {
  const { data: appointments, isLoading } = useMyAppointments();

  const now = Date.now();
  const sorted = [...(appointments ?? [])]
    .filter((a) => a.status !== "HELD")
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const upcoming = sorted.filter((a) => a.status === "BOOKED" && new Date(a.startTime).getTime() > now);
  const past = sorted.filter((a) => !(a.status === "BOOKED" && new Date(a.startTime).getTime() > now));

  function Row({ appt }: { appt: (typeof sorted)[number] }) {
    return (
      <Link
        to={`/appointments/${appt.id}`}
        className="flex items-center justify-between gap-4 border-b border-line py-4 transition hover:bg-bg-raised"
      >
        <div>
          <p className="font-medium text-ink">{doctorLabel(appt.doctor.name)}</p>
          <p className="text-sm text-ink-soft">
            {new Date(appt.startTime).toLocaleString("en-IN", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <StatusPill label={appt.status} tone={STATUS_TONE[appt.status] ?? "neutral"} />
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Appointments</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Everything on your calendar.
      </h1>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      {!isLoading && (
        <>
          <section className="mb-10">
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-soft">Upcoming</p>
            {upcoming.length === 0 ? (
              <div className="rounded-lg border border-line bg-bg-raised px-4 py-4 text-sm text-ink-soft">
                No upcoming appointments.{" "}
                <Link to="/book" className="text-accent underline underline-offset-2">
                  Find a doctor →
                </Link>
              </div>
            ) : (
              <div className="border-t border-line">
                {upcoming.map((a) => (
                  <Row key={a.id} appt={a} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink-soft">Past</p>
              <div className="border-t border-line">
                {past.map((a) => (
                  <Row key={a.id} appt={a} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
