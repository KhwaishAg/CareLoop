import { useMemo, useState } from "react";
import type { Appointment } from "../lib/hooks";
import { doctorLabel } from "../lib/format";

type EventKind = "consultation" | "upcoming" | "follow-up" | "cancelled";

interface TimelineEvent {
  id: string;
  date: Date;
  kind: EventKind;
  title: string;
  subtitle?: string;
  detail?: string;
  tags?: { label: string; tone: "amber" | "success" | "ink-soft" }[];
  medications?: { name: string; dosage: string }[];
}

function buildEvents(appointments: Appointment[]): TimelineEvent[] {
  const now = Date.now();
  const events: TimelineEvent[] = [];

  for (const appt of appointments) {
    if (appt.status === "HELD") continue;

    if (appt.status === "COMPLETED") {
      const tags: TimelineEvent["tags"] = [];
      appt.symptomForm?.changeFromLastVisit?.newSymptoms.forEach((s) => tags.push({ label: `New: ${s}`, tone: "amber" }));
      appt.symptomForm?.changeFromLastVisit?.resolvedSymptoms.forEach((s) =>
        tags.push({ label: `Resolved: ${s}`, tone: "success" })
      );

      events.push({
        id: appt.id,
        date: new Date(appt.startTime),
        kind: "consultation",
        title: appt.symptomForm?.chiefComplaint ?? "Consultation",
        subtitle: doctorLabel(appt.doctor.name),
        detail: appt.visitNote?.patientSummary ?? appt.symptomForm?.rawSymptoms,
        tags,
        medications: appt.medications.map((m) => ({ name: m.name, dosage: m.dosage })),
      });
    } else if (appt.status === "BOOKED") {
      const isFuture = new Date(appt.startTime).getTime() > now;
      events.push({
        id: appt.id,
        date: new Date(appt.startTime),
        kind: isFuture ? "upcoming" : "consultation",
        title: isFuture ? "Upcoming appointment" : "Appointment",
        subtitle: doctorLabel(appt.doctor.name),
      });
    } else if (appt.status === "CANCELLED") {
      events.push({
        id: appt.id,
        date: new Date(appt.startTime),
        kind: "cancelled",
        title: "Cancelled",
        subtitle: doctorLabel(appt.doctor.name),
      });
    }

    if (appt.status === "COMPLETED" && appt.recommendedFollowUpDate) {
      const alreadyBookedLater = appointments.some(
        (b) =>
          b.doctor.id === appt.doctor.id &&
          (b.status === "BOOKED" || b.status === "COMPLETED") &&
          new Date(b.startTime).getTime() > new Date(appt.startTime).getTime()
      );
      if (!alreadyBookedLater) {
        events.push({
          id: `${appt.id}-followup`,
          date: new Date(appt.recommendedFollowUpDate),
          kind: "follow-up",
          title: "Follow-up recommended",
          subtitle: doctorLabel(appt.doctor.name),
        });
      }
    }
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const KIND_DOT: Record<EventKind, string> = {
  consultation: "border-accent bg-accent",
  upcoming: "border-accent bg-bg",
  "follow-up": "border-amber bg-bg",
  cancelled: "border-line bg-bg",
};

/** The signature screen: a real chronological record, grouped by year,
 *  each consultation expandable for the fuller story — not a grid, on
 *  purpose, because the product's differentiator (a remembered journey)
 *  literally has a timeline shape. */
export function HealthTimeline({ appointments, compact = false }: { appointments: Appointment[]; compact?: boolean }) {
  const events = useMemo(() => buildEvents(appointments), [appointments]);
  const visible = compact ? events.slice(0, 4) : events;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (visible.length === 0) {
    return <p className="text-ink-soft">No visits yet — once you book one, your journey starts here.</p>;
  }

  const groups: { year: number; events: TimelineEvent[] }[] = [];
  for (const ev of visible) {
    const year = ev.date.getFullYear();
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.events.push(ev);
    else groups.push({ year, events: [ev] });
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.year}>
          <p className="mb-4 font-display text-2xl font-semibold text-ink-soft">{group.year}</p>
          <ol className="relative ml-2 border-l border-line pl-6">
            {group.events.map((ev) => {
              const isExpandable = ev.kind === "consultation" && (ev.detail || (ev.medications?.length ?? 0) > 0);
              const isOpen = expanded === ev.id;
              return (
                <li key={ev.id} className="relative pb-7 last:pb-0">
                  <span className={`absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 ${KIND_DOT[ev.kind]}`} />
                  <button
                    type="button"
                    disabled={!isExpandable}
                    onClick={() => setExpanded(isOpen ? null : ev.id)}
                    className="w-full text-left"
                  >
                    <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                      {ev.date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                    <p
                      className={`font-medium ${
                        ev.kind === "cancelled" ? "text-ink-soft line-through" : "text-ink"
                      }`}
                    >
                      {ev.title}
                      {isExpandable && (
                        <span className="ml-1.5 text-xs text-ink-soft">{isOpen ? "▲" : "▼"}</span>
                      )}
                    </p>
                    {ev.subtitle && <p className="text-sm text-ink-soft">{ev.subtitle}</p>}
                  </button>

                  {ev.tags && ev.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ev.tags.map((t) => (
                        <span
                          key={t.label}
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            t.tone === "amber"
                              ? "bg-amber-soft text-amber"
                              : t.tone === "success"
                                ? "bg-success-soft text-success"
                                : "bg-bg-raised text-ink-soft"
                          }`}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-3 rounded-lg border border-line bg-bg-raised px-4 py-3 text-sm text-ink-soft">
                      {ev.detail && <p className="mb-2 text-ink">{ev.detail}</p>}
                      {ev.medications && ev.medications.length > 0 && (
                        <div>
                          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-ink-soft">Prescribed</p>
                          <ul className="flex flex-col gap-0.5">
                            {ev.medications.map((m) => (
                              <li key={m.name}>
                                {m.name} — {m.dosage}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
