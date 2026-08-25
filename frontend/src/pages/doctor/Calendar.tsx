import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMyAppointments, type Appointment } from "../../lib/hooks";

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function DoctorCalendar() {
  const { data: appointments, isLoading } = useMyAppointments();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const d of days) map.set(d.toDateString(), []);
    for (const a of appointments ?? []) {
      if (a.status !== "BOOKED" && a.status !== "COMPLETED") continue;
      const start = new Date(a.startTime);
      const key = start.toDateString();
      if (map.has(key)) map.get(key)!.push(a);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return map;
  }, [appointments, days]);

  const today = new Date();
  const weekLabel = `${days[0].toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Schedule</p>
          <h1 className="font-display text-4xl font-semibold text-ink">Calendar.</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
          >
            ← Previous
          </button>
          <span className="font-mono text-sm text-ink-soft">{weekLabel}</span>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
          >
            Next →
          </button>
        </div>
      </div>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((d, i) => {
          const list = byDay.get(d.toDateString()) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toDateString()}
              className={`rounded-lg border p-3 ${isToday ? "border-accent bg-accent-soft/40" : "border-line bg-bg-raised"}`}
            >
              <p className={`mb-2 font-mono text-xs uppercase tracking-wide ${isToday ? "text-accent" : "text-ink-soft"}`}>
                {DAY_LABEL[i]} {d.getDate()}
              </p>
              {list.length === 0 && <p className="text-xs text-ink-soft">No visits</p>}
              <ul className="flex flex-col gap-1.5">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/doctor/appointments/${a.id}`}
                      className={`block rounded-md border px-2 py-1.5 text-xs transition hover:border-accent ${
                        a.status === "COMPLETED" ? "border-line text-ink-soft" : "border-line bg-bg text-ink"
                      }`}
                    >
                      <span className="font-mono">
                        {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </span>{" "}
                      {a.patient.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
