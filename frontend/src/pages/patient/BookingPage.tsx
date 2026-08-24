import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useDoctors, type DoctorProfile } from "../../lib/hooks";
import { AIBadge } from "../../components/AIBadge";
import { doctorLabel } from "../../lib/format";

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

interface HeldAppointment {
  id: string;
  startTime: string;
  holdExpiresAt: string;
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

export function BookingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [dateKey, setDateKey] = useState(toDateKey(new Date()));
  const [held, setHeld] = useState<HeldAppointment | null>(null);
  const [doctorQuery, setDoctorQuery] = useState("");

  const [rawSymptoms, setRawSymptoms] = useState("");
  const [language, setLanguage] = useState("EN");
  const [listening, setListening] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);

  const { data: doctors, isLoading: doctorsLoading } = useDoctors();

  const filteredDoctors = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase();
    if (!q) return doctors ?? [];
    return (doctors ?? []).filter(
      (d) => d.user.name.toLowerCase().includes(q) || d.specialisation.toLowerCase().includes(q)
    );
  }, [doctors, doctorQuery]);

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["slots", doctor?.id, dateKey],
    queryFn: async () =>
      (
        await api.get<{ slots: Slot[]; onLeave: boolean }>("/api/appointments/slots", {
          params: { doctorProfileId: doctor!.id, date: dateKey },
        })
      ).data,
    enabled: !!doctor && step === 2,
  });

  const assistMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ improved: string; clarifyingQuestions: string[] }>("/api/appointments/symptom-assist", {
          rawSymptoms,
          language,
        })
      ).data,
    onSuccess: (result) => {
      setRawSymptoms(result.improved);
      setClarifyingQuestions(result.clarifyingQuestions);
    },
  });

  const holdMutation = useMutation({
    mutationFn: async (startTime: string) =>
      (
        await api.post<{ appointment: HeldAppointment }>("/api/appointments/hold", {
          doctorProfileId: doctor!.id,
          startTime,
        })
      ).data.appointment,
    onSuccess: (appointment) => {
      setHeld(appointment);
      setConfirmError(null);
      setStep(3);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/appointments/${held!.id}/confirm`, {
          rawSymptoms,
          language,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
      navigate("/dashboard", { replace: true });
    },
    onError: (err: any) => {
      setConfirmError(err.response?.data?.error ?? "Couldn't confirm the booking — try again.");
    },
  });

  const msLeft = useCountdown(step === 3 ? held?.holdExpiresAt ?? null : null);
  const holdExpired = msLeft !== null && msLeft <= 0;
  const countdownLabel = useMemo(() => {
    if (msLeft === null) return null;
    const m = Math.floor(msLeft / 60_000);
    const s = Math.floor((msLeft % 60_000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [msLeft]);

  function startVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setConfirmError("Voice input isn't supported in this browser — try typing instead.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "HI" ? "hi-IN" : language === "TA" ? "ta-IN" : language === "TE" ? "te-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setRawSymptoms((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.start();
  }

  function restart() {
    setHeld(null);
    setStep(2);
    setClarifyingQuestions([]);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Book an appointment</p>
      <h1 className="mb-3 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        {step === 1 && "Who would you like to see?"}
        {step === 2 && `Pick a time with ${doctor ? "Dr. " + doctor.user.name.split(" ").pop() : ""}`}
        {step === 3 && "A few details before you go"}
      </h1>

      {/* Step indicator */}
      <div className="mb-10 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
        {["Doctor", "Time", "Symptoms"].map((label, i) => (
          <span key={label} className={`flex items-center gap-2 ${step === i + 1 ? "text-accent" : ""}`}>
            {i > 0 && <span className="text-line">—</span>}
            {label}
          </span>
        ))}
      </div>

      {/* Step 1: choose doctor */}
      {step === 1 && (
        <div>
          <div className="relative mb-6">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M17 17L13.5 13.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={doctorQuery}
              onChange={(e) => setDoctorQuery(e.target.value)}
              placeholder="Search by doctor name or specialisation — e.g. Dermatology"
              className="w-full rounded-lg border border-line bg-bg-raised py-2.5 pl-10 pr-3.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col divide-y divide-line border-y border-line">
            {doctorsLoading && <p className="py-6 text-ink-soft">Loading doctors…</p>}
            {filteredDoctors.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDoctor(d);
                  setStep(2);
                }}
                className="flex items-center justify-between py-5 text-left transition hover:pl-2"
              >
                <div>
                  <p className="font-display text-xl font-semibold text-ink">{doctorLabel(d.user.name)}</p>
                  <p className="text-sm text-ink-soft">{d.specialisation}</p>
                </div>
                <span className="text-ink-soft">→</span>
              </button>
            ))}
            {!doctorsLoading && doctors?.length === 0 && (
              <p className="py-6 text-ink-soft">No doctors available right now.</p>
            )}
            {!doctorsLoading && (doctors?.length ?? 0) > 0 && filteredDoctors.length === 0 && (
              <p className="py-6 text-ink-soft">
                No doctors match "{doctorQuery}" — try a different name or specialisation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: choose date & time */}
      {step === 2 && doctor && (
        <div>
          <button onClick={() => setStep(1)} className="mb-6 text-sm text-ink-soft hover:text-accent">
            ← Choose a different doctor
          </button>

          <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
            {nextDays(14).map((d) => {
              const key = toDateKey(d);
              const isSelected = key === dateKey;
              return (
                <button
                  key={key}
                  onClick={() => setDateKey(key)}
                  className={`flex min-w-[4.25rem] flex-col items-center rounded-lg border px-3 py-2.5 transition ${
                    isSelected ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:border-ink-soft"
                  }`}
                >
                  <span className="font-mono text-xs uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="font-display text-lg font-semibold">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          {slotsLoading && <p className="text-ink-soft">Loading slots…</p>}
          {slotsData?.onLeave && <p className="text-ink-soft">{doctorLabel(doctor.user.name)} is on leave this day.</p>}
          {slotsData && !slotsData.onLeave && slotsData.slots.length === 0 && (
            <p className="text-ink-soft">
              No slots left for this day — try another date, or{" "}
              <Link to="/waitlist" className="text-accent underline underline-offset-2">
                join the waitlist
              </Link>{" "}
              to be offered one automatically.
            </p>
          )}
          {slotsData && slotsData.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {slotsData.slots.map((slot) => (
                <button
                  key={slot.startTime}
                  disabled={holdMutation.isPending}
                  onClick={() => holdMutation.mutate(slot.startTime)}
                  className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {new Date(slot.startTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </button>
              ))}
            </div>
          )}
          {holdMutation.isError && (
            <p className="mt-4 text-sm text-critical">
              {(holdMutation.error as any)?.response?.data?.error ?? "That slot just got taken — pick another."}
            </p>
          )}
        </div>
      )}

      {/* Step 3: symptom form */}
      {step === 3 && held && (
        <div>
          <div className="mb-6 flex items-center justify-between rounded-lg border border-line bg-bg-raised px-4 py-3">
            <p className="text-sm text-ink">
              Holding{" "}
              <strong className="font-medium">
                {new Date(held.startTime).toLocaleString("en-IN", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </strong>{" "}
              with {doctor ? doctorLabel(doctor.user.name) : ""}
            </p>
            {countdownLabel && !holdExpired && (
              <span className="font-mono text-sm text-amber">{countdownLabel} left</span>
            )}
          </div>

          {holdExpired ? (
            <div className="rounded-lg border border-critical bg-critical-soft px-4 py-4 text-sm text-critical">
              This hold expired before you finished. No charge, nothing booked — pick a new time.
              <button onClick={restart} className="ml-3 underline underline-offset-2">
                Choose another slot
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-ink-soft">What's going on? Describe your symptoms.</span>
                  <AIBadge text="AI PREPARES YOUR VISIT BRIEF" />
                </div>
                <textarea
                  rows={5}
                  value={rawSymptoms}
                  onChange={(e) => {
                    setRawSymptoms(e.target.value);
                    if (clarifyingQuestions.length > 0) setClarifyingQuestions([]);
                  }}
                  placeholder="e.g. Fever since yesterday evening, mild headache, no cough…"
                  className="w-full rounded-lg border border-line bg-bg-raised px-3.5 py-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition ${
                      listening ? "border-accent text-accent" : "border-line text-ink-soft hover:border-ink-soft"
                    }`}
                  >
                    {listening ? "Listening…" : "🎙 Speak instead"}
                  </button>
                  <button
                    type="button"
                    disabled={rawSymptoms.trim().length < 3 || assistMutation.isPending}
                    onClick={() => assistMutation.mutate()}
                    className="rounded-lg border border-accent px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assistMutation.isPending ? "Thinking…" : "✨ Help me phrase this"}
                  </button>
                </div>
                {assistMutation.isError && (
                  <p className="mt-2 text-sm text-critical">
                    {(assistMutation.error as any)?.response?.data?.error ?? "Couldn't reach AI assist — try again."}
                  </p>
                )}
                {clarifyingQuestions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-accent bg-accent-soft px-3.5 py-3">
                    <p className="mb-1.5 font-mono text-xs uppercase tracking-wide text-accent">
                      Worth adding, if you can
                    </p>
                    <ul className="flex flex-col gap-1">
                      {clarifyingQuestions.map((q) => (
                        <li key={q} className="text-sm text-ink">
                          • {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => confirmMutation.mutate()}
                  disabled={rawSymptoms.trim().length < 3 || confirmMutation.isPending}
                  className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {confirmMutation.isPending ? "Confirming…" : "Confirm booking"}
                </button>
                <button onClick={restart} className="text-sm text-ink-soft hover:text-accent">
                  Choose a different time
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
