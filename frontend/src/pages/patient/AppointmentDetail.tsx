import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useDoctors, useMyAppointments } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { AIBadge } from "../../components/AIBadge";
import { doctorLabel } from "../../lib/format";

const URGENCY_TONE = { LOW: "positive", MEDIUM: "warning", HIGH: "critical" } as const;
const STATUS_TONE = {
  HELD: "warning",
  BOOKED: "positive",
  COMPLETED: "info",
  CANCELLED: "neutral",
} as const;
const FOLLOW_UP_TONE = { OVERDUE: "critical", DUE_SOON: "warning", ON_TRACK: "positive", SCHEDULED: "info" } as const;
const FOLLOW_UP_LABEL = {
  OVERDUE: "Follow-up overdue",
  DUE_SOON: "Follow-up due soon",
  ON_TRACK: "Follow-up on track",
  SCHEDULED: "Follow-up scheduled",
} as const;

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "HI", label: "हिन्दी" },
  { code: "TA", label: "தமிழ்" },
  { code: "TE", label: "తెలుగు" },
];

interface Slot {
  startTime: string;
  endTime: string;
}

function nextDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}
function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function useCountdown(target: string | null) {
  const [msLeft, setMsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) {
      setMsLeft(null);
      return;
    }
    const targetMs = new Date(target).getTime();
    const tick = () => setMsLeft(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return msLeft;
}

export function PatientAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appointments, isLoading } = useMyAppointments();
  const { data: doctors } = useDoctors();
  const appointment = appointments?.find((a) => a.id === id);

  // The reschedule endpoint takes a doctorProfileId, but an appointment
  // only carries the doctor's user id — resolve it from the doctor list.
  const doctorProfile = doctors?.find((d) => d.user.id === appointment?.doctor.id);

  const [rescheduling, setRescheduling] = useState(false);
  const [dateKey, setDateKey] = useState(toDateKey(new Date()));
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const [rawSymptoms, setRawSymptoms] = useState("");
  const [language, setLanguage] = useState("EN");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["slots", doctorProfile?.id, dateKey],
    queryFn: async () =>
      (
        await api.get<{ slots: Slot[]; onLeave: boolean }>("/api/appointments/slots", {
          params: { doctorProfileId: doctorProfile!.id, date: dateKey },
        })
      ).data,
    enabled: !!doctorProfile && rescheduling,
  });

  const { data: followUp } = useQuery({
    queryKey: ["appointments", id, "follow-up"],
    queryFn: async () =>
      (
        await api.get<{ status: string; recommendedFollowUpDate: string | null; nextAppointmentId: string | null }>(
          `/api/appointments/${id}/follow-up`
        )
      ).data,
    enabled: appointment?.status === "COMPLETED" && !!appointment.recommendedFollowUpDate,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/appointments/${id}/cancel`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
      navigate("/dashboard", { replace: true });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (newStartTime: string) =>
      (
        await api.post(`/api/appointments/${id}/reschedule`, {
          doctorProfileId: doctorProfile!.id,
          newStartTime,
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
      navigate(`/appointments/${data.appointment.id}`, { replace: true });
    },
    onError: (err: any) => setRescheduleError(err.response?.data?.error ?? "That slot didn't work — try another."),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/appointments/${id}/confirm`, { rawSymptoms, language })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
    },
    onError: (err: any) => setConfirmError(err.response?.data?.error ?? "Couldn't confirm — try again."),
  });

  const msLeft = useCountdown(appointment?.status === "HELD" ? appointment.holdExpiresAt : null);
  const holdExpired = msLeft !== null && msLeft <= 0;
  const countdownLabel = useMemo(() => {
    if (msLeft === null) return null;
    const m = Math.floor(msLeft / 60_000);
    const s = Math.floor((msLeft % 60_000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [msLeft]);

  if (isLoading) return <div className="mx-auto max-w-3xl px-6 py-12 text-ink-soft">Loading…</div>;
  if (!appointment)
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-ink-soft">Appointment not found.</p>
        <Link to="/dashboard" className="text-accent underline underline-offset-2">
          Back home
        </Link>
      </div>
    );

  const { symptomForm, visitNote } = appointment;
  const canCancel = appointment.status === "BOOKED" || appointment.status === "HELD";
  const canReschedule = appointment.status === "BOOKED";
  const needsConfirmation = appointment.status === "HELD" && !symptomForm;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/dashboard" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Back home
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4 border-b border-line pb-8">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">
            {doctorLabel(appointment.doctor.name)}
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {new Date(appointment.startTime).toLocaleString("en-IN", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill label={appointment.status} tone={STATUS_TONE[appointment.status]} />
          {followUp && followUp.status !== "NONE" && (
            <StatusPill
              label={FOLLOW_UP_LABEL[followUp.status as keyof typeof FOLLOW_UP_LABEL]}
              tone={FOLLOW_UP_TONE[followUp.status as keyof typeof FOLLOW_UP_TONE]}
            />
          )}
        </div>
      </div>

      {/* A held slot (usually a waitlist offer) awaiting the symptom form */}
      {needsConfirmation && (
        <section className="mb-8 border-b border-line pb-8">
          {holdExpired ? (
            <div className="rounded-lg border border-critical bg-critical-soft px-4 py-4 text-sm text-critical">
              This hold expired before it was confirmed. Nothing was booked —{" "}
              <Link to="/book" className="underline underline-offset-2">
                book a new time
              </Link>{" "}
              or{" "}
              <Link to="/waitlist" className="underline underline-offset-2">
                rejoin the waitlist
              </Link>
              .
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-amber bg-amber-soft px-4 py-3">
                <p className="text-sm text-ink">This slot is being held for you — confirm to lock it in.</p>
                {countdownLabel && <span className="font-mono text-sm text-amber">{countdownLabel} left</span>}
              </div>

              <div className="mb-4">
                <p className="mb-0.5 text-sm text-ink-soft">Before we confirm your appointment —</p>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-ink">Tell your doctor what you're experiencing.</span>
                  <AIBadge text="AI-assisted" />
                </div>
                <textarea
                  rows={5}
                  value={rawSymptoms}
                  onChange={(e) => setRawSymptoms(e.target.value)}
                  placeholder="e.g. Fever since yesterday evening, mild headache, no cough…"
                  className="w-full rounded-lg border border-line bg-bg-raised px-3.5 py-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="mb-6 flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">Language</span>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      type="button"
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        language === lang.code
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line text-ink-soft hover:border-ink-soft"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {confirmError && <p className="mb-4 text-sm text-critical">{confirmError}</p>}

              <button
                onClick={() => confirmMutation.mutate()}
                disabled={rawSymptoms.trim().length < 3 || confirmMutation.isPending}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {confirmMutation.isPending ? "Confirming…" : "Confirm booking"}
              </button>
            </>
          )}
        </section>
      )}

      {/* Pre-visit AI brief */}
      {symptomForm && (
        <section className="mb-8 border-b border-line pb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your visit brief</p>
            {symptomForm.status === "READY" && <AIBadge />}
          </div>

          {symptomForm.safetySignalFlagged && (
            <div className="mb-4 rounded-lg border border-critical bg-critical-soft px-4 py-3 text-sm text-critical">
              This was flagged for prompt clinical attention. {symptomForm.safetySignalReason}
            </div>
          )}

          {symptomForm.status === "PENDING" && (
            <p className="text-ink-soft">Preparing your visit summary…</p>
          )}
          {symptomForm.status === "FAILED" && (
            <p className="text-ink-soft">Your doctor will review your symptoms directly.</p>
          )}
          {symptomForm.status === "READY" && (
            <div className="flex flex-col gap-4">
              {symptomForm.urgency && (
                <StatusPill label={`${symptomForm.urgency} urgency`} tone={URGENCY_TONE[symptomForm.urgency]} />
              )}
              {symptomForm.chiefComplaint && <p className="text-ink">{symptomForm.chiefComplaint}</p>}
              {symptomForm.changeFromLastVisit && (
                <div className="rounded-lg border border-line bg-bg-raised px-4 py-3 text-sm text-ink-soft">
                  <p className="mb-1 font-medium text-ink">Since your last visit</p>
                  {symptomForm.changeFromLastVisit.summary}
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-sm text-ink-soft">
            <span className="text-ink">What you told us: </span>
            {symptomForm.rawSymptoms}
          </p>
        </section>
      )}

      {/* Post-visit summary + prescriptions — the review interface a patient
         actually reads after a visit, so it gets a distinct, letter-like
         treatment rather than being one more plain section in the page. */}
      {appointment.status === "COMPLETED" && visitNote && (
        <section className="mb-8 overflow-hidden rounded-xl border border-line bg-bg-raised">
          <div className="flex items-center justify-between border-b border-line bg-accent-soft px-6 py-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-accent">Visit summary</p>
              <p className="text-sm text-ink-soft">{doctorLabel(appointment.doctor.name)}</p>
            </div>
            {visitNote.status === "READY" && <AIBadge text="AI-assisted · Doctor reviewed" />}
          </div>

          <div className="px-6 py-6">
            {visitNote.status === "PENDING" && <p className="text-ink-soft">Preparing your summary…</p>}
            {visitNote.patientSummary && (
              <p className="mb-6 text-lg leading-relaxed text-ink">{visitNote.patientSummary}</p>
            )}

            {appointment.medications.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-sm font-medium text-ink">Prescribed</p>
                <ul className="flex flex-col gap-2">
                  {appointment.medications.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 rounded-lg border border-line bg-bg px-4 py-3 text-sm"
                    >
                      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
                        ●
                      </span>
                      <div>
                        <p className="font-medium text-ink">
                          {m.name} <span className="font-normal text-ink-soft">· {m.dosage}</span>
                        </p>
                        <p className="text-ink-soft">{m.frequencyType.replace(/_/g, " ").toLowerCase()}</p>
                        {m.instructions && <p className="mt-1 text-ink-soft">{m.instructions}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {visitNote.followUpSteps && (
              <div className="rounded-lg border border-line bg-bg px-4 py-3 text-sm">
                <p className="mb-1 font-medium text-ink">Next steps</p>
                <p className="text-ink-soft">{visitNote.followUpSteps}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {(canCancel || canReschedule) && !rescheduling && (
        <div className="flex items-center gap-3">
          {canReschedule && (
            <button
              onClick={() => setRescheduling(true)}
              disabled={!doctorProfile}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Reschedule
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="rounded-lg border border-critical px-4 py-2 text-sm text-critical transition hover:bg-critical-soft disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel appointment"}
            </button>
          )}
        </div>
      )}

      {canReschedule && rescheduling && (
        <section className="border-t border-line pt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Pick a new time</p>
            <button onClick={() => setRescheduling(false)} className="text-sm text-ink-soft hover:text-ink">
              Cancel
            </button>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {nextDays(14).map((d) => {
              const key = toDateKey(d);
              return (
                <button
                  key={key}
                  onClick={() => setDateKey(key)}
                  className={`flex min-w-[4.25rem] flex-col items-center rounded-lg border px-3 py-2.5 transition ${
                    key === dateKey ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:border-ink-soft"
                  }`}
                >
                  <span className="font-mono text-xs uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          {slotsLoading && <p className="text-ink-soft">Loading slots…</p>}
          {slotsData && slotsData.slots.length === 0 && <p className="text-ink-soft">No slots left for this day.</p>}
          {slotsData && slotsData.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slotsData.slots.map((slot) => (
                <button
                  key={slot.startTime}
                  disabled={rescheduleMutation.isPending}
                  onClick={() => rescheduleMutation.mutate(slot.startTime)}
                  className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {new Date(slot.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </button>
              ))}
            </div>
          )}
          {rescheduleError && <p className="mt-4 text-sm text-critical">{rescheduleError}</p>}
        </section>
      )}
    </div>
  );
}
