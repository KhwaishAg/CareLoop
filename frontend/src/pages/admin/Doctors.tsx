import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useDoctors, type WorkingHours } from "../../lib/hooks";
import { doctorLabel } from "../../lib/format";

const DAY_ORDER: (keyof WorkingHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT: Record<keyof WorkingHours, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** Collapses a working-hours map into a short human summary, e.g.
 *  "Mon–Fri · 9:00 AM–5:00 PM" instead of dumping the raw structure. */
function summariseHours(hours: WorkingHours | undefined): string {
  if (!hours) return "Working hours not set";
  const active = DAY_ORDER.filter((d) => hours[d]?.length);
  if (active.length === 0) return "No working days set";

  // Detect a single contiguous run (the common case) for a compact range.
  const idxs = active.map((d) => DAY_ORDER.indexOf(d));
  const isContiguous = idxs.every((v, i) => i === 0 || v === idxs[i - 1] + 1);
  const dayLabel = isContiguous
    ? active.length === 1
      ? DAY_SHORT[active[0]]
      : `${DAY_SHORT[active[0]]}–${DAY_SHORT[active[active.length - 1]]}`
    : active.map((d) => DAY_SHORT[d]).join(", ");

  const sampleTimes = hours[active[0]];
  const timeLabel = sampleTimes?.length === 2 ? `${to12h(sampleTimes[0])}–${to12h(sampleTimes[1])}` : "";
  return timeLabel ? `${dayLabel} · ${timeLabel}` : dayLabel;
}

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

const DAYS: { key: keyof WorkingHours; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function defaultHours(): WorkingHours {
  return {
    mon: ["09:00", "17:00"],
    tue: ["09:00", "17:00"],
    wed: ["09:00", "17:00"],
    thu: ["09:00", "17:00"],
    fri: ["09:00", "17:00"],
    sat: [],
    sun: [],
  };
}

export function AdminDoctors() {
  const queryClient = useQueryClient();
  const { data: doctors, isLoading } = useDoctors();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    specialisation: "",
    slotDurationMin: 30,
  });
  const [hours, setHours] = useState<WorkingHours>(defaultHours());
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: keyof WorkingHours) {
    setHours((h) => ({ ...h, [day]: h[day].length ? [] : ["09:00", "17:00"] }));
  }

  function setDayTime(day: keyof WorkingHours, index: 0 | 1, value: string) {
    setHours((h) => {
      const next = [...h[day]];
      next[index] = value;
      return { ...h, [day]: next };
    });
  }

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/admin/doctors", {
          ...form,
          workingHours: hours,
        })
      ).data,
    onSuccess: () => {
      setError(null);
      setShowForm(false);
      setForm({ name: "", email: "", password: "", specialisation: "", slotDurationMin: 30 });
      setHours(defaultHours());
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
    onError: (err: any) => setError(err.response?.data?.error ?? "Couldn't create doctor — try again."),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = doctors ?? [];
    if (!q) return list;
    return list.filter(
      (d) => d.user.name.toLowerCase().includes(q) || d.specialisation.toLowerCase().includes(q)
    );
  }, [doctors, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const key = d.specialisation || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/admin" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Overview
      </Link>

      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold text-ink">Doctors</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ Add doctor"}
        </button>
      </div>
      <p className="mb-8 text-ink-soft">
        {doctors?.length ?? 0} doctor{(doctors?.length ?? 0) === 1 ? "" : "s"} across {grouped.length || 0}{" "}
        specialisation{grouped.length === 1 ? "" : "s"}.
      </p>

      {!showForm && (doctors?.length ?? 0) > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or specialisation…"
          className="mb-8 w-full max-w-sm rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
      )}

      {showForm && (
        <div className="mb-12 rounded-lg border border-line bg-bg-raised p-6">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Full name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Specialisation</span>
              <input
                value={form.specialisation}
                onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Temporary password</span>
              <input
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Slot duration (minutes)</span>
              <input
                type="number"
                min={5}
                max={240}
                value={form.slotDurationMin}
                onChange={(e) => setForm({ ...form, slotDurationMin: Number(e.target.value) })}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
          </div>

          <p className="mb-2 text-sm text-ink-soft">Working hours</p>
          <div className="mb-4 flex flex-col gap-2">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-24 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={hours[key].length > 0} onChange={() => toggleDay(key)} />
                  {label}
                </label>
                {hours[key].length > 0 ? (
                  <>
                    <input
                      type="time"
                      value={hours[key][0]}
                      onChange={(e) => setDayTime(key, 0, e.target.value)}
                      className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <span className="text-ink-soft">–</span>
                    <input
                      type="time"
                      value={hours[key][1]}
                      onChange={(e) => setDayTime(key, 1, e.target.value)}
                      className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  </>
                ) : (
                  <span className="text-sm text-ink-soft">Off</span>
                )}
              </div>
            ))}
          </div>

          {error && <p className="mb-3 text-sm text-critical">{error}</p>}

          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.name || !form.email || form.password.length < 8 || !form.specialisation || createMutation.isPending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create doctor"}
          </button>
        </div>
      )}

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-line bg-bg-raised px-4 py-6 text-sm text-ink-soft">
          {query ? `No doctors match "${query}".` : "No doctors yet — add the first one above."}
        </div>
      )}

      <div className="flex flex-col gap-10">
        {grouped.map(([specialisation, group]) => (
          <section key={specialisation}>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">
              {specialisation} · {group.length}
            </p>
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {group.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent">
                      {initials(d.user.name)}
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold text-ink">{doctorLabel(d.user.name)}</p>
                      <p className="text-sm text-ink-soft">
                        {summariseHours(d.workingHours)} · {d.slotDurationMin}-minute slots
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/admin/doctors/${d.id}/leave`}
                    className="flex-none text-sm text-ink-soft hover:text-accent"
                  >
                    Manage leave →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
