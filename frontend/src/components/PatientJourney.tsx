import type { Appointment } from "../lib/hooks";

/** The signature visual of the whole app — a vertical timeline rather than
 *  a grid of cards, because the product's actual differentiator (visit →
 *  treatment → follow-up → next visit → change detection) is literally a
 *  timeline shape, not a dashboard shape. */
export function PatientJourney({
  appointments,
  perspective = "patient",
}: {
  appointments: Appointment[];
  /** "patient": show the doctor's name on each entry (patient's own view).
   *  "doctor": show the patient's name instead (doctor viewing one patient's history). */
  perspective?: "patient" | "doctor";
}) {
  const sorted = [...appointments]
    .filter((a) => a.status !== "HELD")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (sorted.length === 0) {
    return <p className="text-ink-soft">No visits yet — once you book one, your journey starts here.</p>;
  }

  const now = Date.now();

  return (
    <ol className="relative ml-2 border-l border-line pl-6">
      {sorted.map((appt) => {
        const isFuture = new Date(appt.startTime).getTime() > now;
        const isCancelled = appt.status === "CANCELLED";
        const date = new Date(appt.startTime).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const label = isCancelled
          ? "Cancelled"
          : appt.status === "COMPLETED"
            ? appt.symptomForm?.chiefComplaint ?? "Consultation"
            : "Upcoming appointment";

        return (
          <li key={appt.id} className="relative pb-8 last:pb-0">
            <span
              className={`absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 ${
                isCancelled
                  ? "border-line bg-bg"
                  : isFuture
                    ? "border-accent bg-bg"
                    : "border-accent bg-accent"
              }`}
            />
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">{date}</p>
            <p className={`font-medium ${isCancelled ? "text-ink-soft line-through" : "text-ink"}`}>
              {label}
            </p>
            <p className="text-sm text-ink-soft">
              {perspective === "patient" ? `Dr. ${appt.doctor.name}` : appt.patient.name}
            </p>
            {appt.symptomForm?.changeFromLastVisit?.newSymptoms?.length ? (
              <p className="mt-1 text-sm text-amber">
                + New: {appt.symptomForm.changeFromLastVisit.newSymptoms.join(", ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
