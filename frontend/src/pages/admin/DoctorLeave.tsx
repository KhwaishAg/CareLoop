import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useDoctor, type WorkingHours } from "../../lib/hooks";
import { doctorLabel } from "../../lib/format";

interface AffectedAppointment {
  id: string;
  startTime: string;
  patient: { name: string };
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDoctorLeave() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: doctor, isLoading } = useDoctor(id);

  const [date, setDate] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<AffectedAppointment[] | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [specialisation, setSpecialisation] = useState("");
  const [slotDurationMin, setSlotDurationMin] = useState(30);
  const [hours, setHours] = useState<WorkingHours | null>(null);

  // Seed the edit form from the fetched doctor once it arrives.
  useEffect(() => {
    if (doctor && !editingProfile) {
      setSpecialisation(doctor.specialisation);
      setSlotDurationMin(doctor.slotDurationMin);
      if (doctor.workingHours) setHours(doctor.workingHours);
    }
  }, [doctor]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDay(day: keyof WorkingHours) {
    setHours((h) => (h ? { ...h, [day]: h[day].length ? [] : ["09:00", "17:00"] } : h));
  }
  function setDayTime(day: keyof WorkingHours, index: 0 | 1, value: string) {
    setHours((h) => {
      if (!h) return h;
      const next = [...h[day]];
      next[index] = value;
      return { ...h, [day]: next };
    });
  }

  const updateMutation = useMutation({
    mutationFn: async () =>
      (await api.put(`/api/admin/doctors/${id}`, { specialisation, slotDurationMin, workingHours: hours })).data,
    onSuccess: () => {
      setEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () =>
      (await api.post<{ affectedAppointments: AffectedAppointment[] }>(`/api/admin/doctors/${id}/leave/preview`, { date }))
        .data.affectedAppointments,
    onSuccess: (affected) => setPreview(affected),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/admin/doctors/${id}/leave`, { date, reason: reason || undefined })).data,
    onSuccess: () => {
      setPreview(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["doctors", "one", id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (leaveId: string) => api.delete(`/api/admin/doctors/${id}/leave/${leaveId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctors", "one", id] }),
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-6 py-12 text-ink-soft">Loading…</div>;
  if (!doctor) return <div className="mx-auto max-w-4xl px-6 py-12 text-ink-soft">Doctor not found.</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/admin/doctors" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Doctors
      </Link>

      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Manage doctor</p>
          <h1 className="font-display text-4xl font-semibold text-ink">{doctorLabel(doctor.user.name)}</h1>
          {!editingProfile && (
            <p className="mt-1 text-ink-soft">
              {doctor.specialisation} · {doctor.slotDurationMin}-minute slots
            </p>
          )}
        </div>
        <button
          onClick={() => setEditingProfile((v) => !v)}
          className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-accent hover:text-accent"
        >
          {editingProfile ? "Cancel" : "Edit profile"}
        </button>
      </div>

      {editingProfile && hours && (
        <section className="mb-12 rounded-lg border border-line bg-bg-raised p-6">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Specialisation</span>
              <input
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value)}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Slot duration (minutes)</span>
              <input
                type="number"
                min={5}
                max={240}
                value={slotDurationMin}
                onChange={(e) => setSlotDurationMin(Number(e.target.value))}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
          </div>

          <p className="mb-2 text-sm text-ink-soft">Working hours</p>
          <div className="mb-5 flex flex-col gap-2">
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

          <button
            onClick={() => updateMutation.mutate()}
            disabled={!specialisation || updateMutation.isPending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </section>
      )}

      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Leave scheduling</p>

      <section className="mb-12 mt-4 rounded-lg border border-line bg-bg-raised p-6">
        <div className="mb-4 flex items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Date</span>
            <input
              type="date"
              min={todayKey()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPreview(null);
              }}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Reason (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
            />
          </label>
        </div>

        {preview === null ? (
          <button
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {previewMutation.isPending ? "Checking…" : "Preview impact"}
          </button>
        ) : (
          <div>
            {preview.length === 0 ? (
              <p className="mb-4 text-sm text-ink-soft">No booked appointments on this day — safe to mark as leave.</p>
            ) : (
              <div className="mb-4 rounded-lg border border-amber bg-amber-soft px-4 py-3 text-sm text-ink">
                <p className="mb-2 font-medium">
                  {preview.length} appointment{preview.length === 1 ? "" : "s"} will be cancelled and the patients
                  notified:
                </p>
                <ul className="list-inside list-disc text-ink-soft">
                  {preview.map((a) => (
                    <li key={a.id}>
                      {a.patient.name} —{" "}
                      {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {confirmMutation.isPending ? "Confirming…" : "Confirm leave day"}
              </button>
              <button onClick={() => setPreview(null)} className="text-sm text-ink-soft hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Scheduled leave</p>
      {doctor.leaveDays?.length === 0 && <p className="text-ink-soft">No leave days scheduled.</p>}
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {doctor.leaveDays?.map((l) => (
          <li key={l.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-ink">{new Date(l.date).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</p>
              {l.reason && <p className="text-sm text-ink-soft">{l.reason}</p>}
            </div>
            <button
              onClick={() => removeMutation.mutate(l.id)}
              disabled={removeMutation.isPending}
              className="text-sm text-critical hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
