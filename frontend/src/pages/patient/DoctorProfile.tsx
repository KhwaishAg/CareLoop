import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useDoctor, type WorkingHours } from "../../lib/hooks";
import { doctorLabel } from "../../lib/format";

const DAY_ORDER: (keyof WorkingHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<keyof WorkingHours, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

interface Slot {
  startTime: string;
  endTime: string;
}

function NextAvailable({ doctorProfileId }: { doctorProfileId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const { data: todaySlots, isLoading } = useQuery({
    queryKey: ["slots", doctorProfileId, today],
    queryFn: async () =>
      (await api.get<{ slots: Slot[]; onLeave: boolean }>("/api/appointments/slots", { params: { doctorProfileId, date: today } })).data,
  });
  const { data: tomorrowSlots } = useQuery({
    queryKey: ["slots", doctorProfileId, tomorrow],
    queryFn: async () =>
      (await api.get<{ slots: Slot[]; onLeave: boolean }>("/api/appointments/slots", { params: { doctorProfileId, date: tomorrow } })).data,
    enabled: !isLoading && (!todaySlots || todaySlots.slots.length === 0),
  });

  if (isLoading) return <span className="text-sm text-ink-soft">Checking availability…</span>;
  if (todaySlots && todaySlots.slots.length > 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Next available Today · {new Date(todaySlots.slots[0].startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
      </span>
    );
  }
  if (tomorrowSlots && tomorrowSlots.slots.length > 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Next available Tomorrow · {new Date(tomorrowSlots.slots[0].startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
      </span>
    );
  }
  return <span className="text-sm text-ink-soft">No slots in the next 2 days</span>;
}

export function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: doctor, isLoading } = useDoctor(id);

  if (isLoading) return <div className="mx-auto max-w-2xl px-6 py-12 text-ink-soft">Loading…</div>;
  if (!doctor)
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-ink-soft">Doctor not found.</p>
        <Link to="/book" className="text-accent underline underline-offset-2">
          Back to find a doctor
        </Link>
      </div>
    );

  const hours = doctor.workingHours;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/book" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Find a Doctor
      </Link>

      <div className="mb-8 flex items-start gap-5">
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-accent-soft font-display text-2xl font-semibold text-accent">
          {initials(doctor.user.name)}
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{doctorLabel(doctor.user.name)}</h1>
          <p className="text-ink-soft">
            {doctor.specialisation} · {doctor.slotDurationMin}-minute consultations
          </p>
          <div className="mt-2">
            <NextAvailable doctorProfileId={doctor.id} />
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate("/book", { state: { doctorId: doctor.id } })}
        className="mb-10 w-full rounded-lg bg-accent px-5 py-3 text-center font-medium text-white transition hover:opacity-90 sm:w-auto"
      >
        Book with {doctorLabel(doctor.user.name)}
      </button>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Working hours</p>
        {!hours ? (
          <p className="text-ink-soft">Working hours not set.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {DAY_ORDER.map((day) => {
              const range = hours[day];
              const today = DAY_ORDER[(new Date().getDay() + 6) % 7] === day; // Mon=0 alignment
              return (
                <li key={day} className="flex items-center justify-between py-3">
                  <span className={today ? "font-medium text-ink" : "text-ink-soft"}>{DAY_LABEL[day]}</span>
                  <span className={range?.length ? "text-ink" : "text-ink-soft"}>
                    {range?.length ? `${to12h(range[0])} – ${to12h(range[1])}` : "Closed"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
