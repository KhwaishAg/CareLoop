import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useMyAppointments, useMedicineCatalog } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { AIBadge } from "../../components/AIBadge";

const URGENCY_TONE = { LOW: "positive", MEDIUM: "warning", HIGH: "critical" } as const;

const FREQUENCIES = [
  "ONCE_DAILY",
  "TWICE_DAILY",
  "THRICE_DAILY",
  "EVERY_6_HOURS",
  "EVERY_8_HOURS",
  "EVERY_12_HOURS",
  "AS_NEEDED",
];

interface MedRow {
  name: string;
  dosage: string;
  frequencyType: string;
  startDate: string;
  endDate: string;
  instructions: string;
}

function emptyMed(): MedRow {
  const today = new Date().toISOString().slice(0, 10);
  return { name: "", dosage: "", frequencyType: "ONCE_DAILY", startDate: today, endDate: today, instructions: "" };
}

export function DoctorAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appointments, isLoading } = useMyAppointments();
  const appointment = appointments?.find((a) => a.id === id);
  const { data: catalog } = useMedicineCatalog();

  const [clinicalNotes, setClinicalNotes] = useState("");
  const [recommendedFollowUpDate, setRecommendedFollowUpDate] = useState("");
  const [medications, setMedications] = useState<MedRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openSuggestionsFor, setOpenSuggestionsFor] = useState<number | null>(null);

  function suggestionsFor(name: string) {
    const q = name.trim().toLowerCase();
    if (!q || !catalog) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }

  function pickMedicine(i: number, name: string, dosage: string, frequencyType: string | null) {
    setMedications((m) =>
      m.map((x, j) =>
        j === i
          ? {
              ...x,
              name,
              dosage: x.dosage.trim() ? x.dosage : dosage,
              frequencyType: frequencyType ?? x.frequencyType,
            }
          : x
      )
    );
    setOpenSuggestionsFor(null);
  }

  const completeMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/appointments/${id}/complete`, {
          clinicalNotes,
          recommendedFollowUpDate: recommendedFollowUpDate || undefined,
          medications: medications.filter((m) => m.name.trim()),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
      navigate("/doctor", { replace: true });
    },
    onError: (err: any) => setError(err.response?.data?.error ?? "Couldn't complete the visit — try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/appointments/${id}/cancel`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", "mine"] });
      navigate("/doctor", { replace: true });
    },
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-6 py-12 text-ink-soft">Loading…</div>;
  if (!appointment)
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-ink-soft">Appointment not found.</p>
        <Link to="/doctor" className="text-accent underline underline-offset-2">
          Back to today
        </Link>
      </div>
    );

  const { symptomForm } = appointment;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/doctor" className="mb-6 inline-block text-sm text-ink-soft hover:text-accent">
        ← Back to today
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4 border-b border-line pb-8">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">
            {new Date(appointment.startTime).toLocaleString("en-IN", {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">{appointment.patient.name}</h1>
          <Link
            to={`/doctor/patients/${appointment.patient.id}`}
            className="text-sm text-ink-soft underline underline-offset-2 hover:text-accent"
          >
            View full history with this patient →
          </Link>
        </div>
        <StatusPill label={appointment.status} tone={appointment.status === "BOOKED" ? "positive" : "neutral"} />
      </div>

      {/* AI pre-visit brief */}
      {symptomForm && (
        <section className="mb-10 border-b border-line pb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Pre-visit brief</p>
            {symptomForm.status === "READY" && <AIBadge />}
          </div>

          {symptomForm.safetySignalFlagged && (
            <div className="mb-4 rounded-lg border border-critical bg-critical-soft px-4 py-3 text-sm text-critical">
              <strong className="font-medium">Flagged for attention.</strong> {symptomForm.safetySignalReason}
            </div>
          )}

          {symptomForm.status === "PENDING" && <p className="text-ink-soft">Brief is still being prepared…</p>}
          {symptomForm.status === "FAILED" && <p className="text-ink-soft">Brief generation failed — review the raw symptoms below.</p>}

          {symptomForm.status === "READY" && (
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {symptomForm.urgency && (
                  <StatusPill label={`${symptomForm.urgency} urgency`} tone={URGENCY_TONE[symptomForm.urgency]} />
                )}
              </div>
              {symptomForm.chiefComplaint && (
                <p className="text-ink">
                  <span className="text-ink-soft">Chief complaint: </span>
                  {symptomForm.chiefComplaint}
                </p>
              )}
              {symptomForm.urgencyFactors && symptomForm.urgencyFactors.length > 0 && (
                <ul className="list-inside list-disc text-sm text-ink-soft">
                  {symptomForm.urgencyFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
              {symptomForm.suggestedQuestions && symptomForm.suggestedQuestions.length > 0 && (
                <div className="rounded-lg border border-line bg-bg-raised px-4 py-3 text-sm">
                  <p className="mb-1 font-medium text-ink">Suggested questions to ask</p>
                  <ul className="list-inside list-disc text-ink-soft">
                    {symptomForm.suggestedQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {symptomForm.changeFromLastVisit && (
                <div className="rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm text-ink">
                  <p className="mb-1 font-medium">What's changed since the last visit</p>
                  <p className="mb-2 text-ink-soft">{symptomForm.changeFromLastVisit.summary}</p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {symptomForm.changeFromLastVisit.newSymptoms.length > 0 && (
                      <span>
                        <strong>New:</strong> {symptomForm.changeFromLastVisit.newSymptoms.join(", ")}
                      </span>
                    )}
                    {symptomForm.changeFromLastVisit.resolvedSymptoms.length > 0 && (
                      <span>
                        <strong>Resolved:</strong> {symptomForm.changeFromLastVisit.resolvedSymptoms.join(", ")}
                      </span>
                    )}
                    {symptomForm.changeFromLastVisit.ongoingSymptoms.length > 0 && (
                      <span>
                        <strong>Ongoing:</strong> {symptomForm.changeFromLastVisit.ongoingSymptoms.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-ink-soft">
            <span className="text-ink">Patient reported: </span>
            {symptomForm.rawSymptoms}
          </p>
        </section>
      )}

      {/* Complete visit form */}
      {appointment.status === "BOOKED" && (
        <section>
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Complete this visit</p>

          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Clinical notes</span>
            <textarea
              rows={4}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Diagnosis, examination findings, treatment plan…"
              className="rounded-lg border border-line bg-bg-raised px-3.5 py-3 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>

          <label className="mb-6 flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Recommended follow-up date (optional)</span>
            <input
              type="date"
              value={recommendedFollowUpDate}
              onChange={(e) => setRecommendedFollowUpDate(e.target.value)}
              className="w-48 rounded-lg border border-line bg-bg-raised px-3.5 py-2.5 outline-none focus:border-accent"
            />
          </label>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-ink-soft">Prescriptions</span>
              <button
                type="button"
                onClick={() => setMedications((m) => [...m, emptyMed()])}
                className="rounded-lg border border-line px-3 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent"
              >
                + Add medication
              </button>
            </div>
            {medications.map((med, i) => (
              <div key={i} className="mb-3 rounded-lg border border-line bg-bg-raised p-4">
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      placeholder="Medication name"
                      value={med.name}
                      onChange={(e) => {
                        setMedications((m) => m.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)));
                        setOpenSuggestionsFor(i);
                      }}
                      onFocus={() => setOpenSuggestionsFor(i)}
                      onBlur={() => setTimeout(() => setOpenSuggestionsFor((cur) => (cur === i ? null : cur)), 150)}
                      autoComplete="off"
                      className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    {openSuggestionsFor === i && suggestionsFor(med.name).length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-line bg-bg-raised shadow-lg">
                        {suggestionsFor(med.name).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() =>
                              pickMedicine(i, entry.name, entry.commonDosages[0] ?? "", entry.defaultFrequency)
                            }
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-accent-soft"
                          >
                            <span>{entry.name}</span>
                            {entry.category && <span className="text-xs text-ink-soft">{entry.category}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    placeholder="Dosage (e.g. 500mg)"
                    value={med.dosage}
                    onChange={(e) =>
                      setMedications((m) => m.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))
                    }
                    className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <select
                    value={med.frequencyType}
                    onChange={(e) =>
                      setMedications((m) => m.map((x, j) => (j === i ? { ...x, frequencyType: e.target.value } : x)))
                    }
                    className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f.replace(/_/g, " ").toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={med.startDate}
                    onChange={(e) =>
                      setMedications((m) => m.map((x, j) => (j === i ? { ...x, startDate: e.target.value } : x)))
                    }
                    className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <input
                    type="date"
                    value={med.endDate}
                    onChange={(e) =>
                      setMedications((m) => m.map((x, j) => (j === i ? { ...x, endDate: e.target.value } : x)))
                    }
                    className="rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    placeholder="Instructions (optional)"
                    value={med.instructions}
                    onChange={(e) =>
                      setMedications((m) => m.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))
                    }
                    className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setMedications((m) => m.filter((_, j) => j !== i))}
                    className="text-xs text-critical hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mb-4 text-sm text-critical">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={() => completeMutation.mutate()}
              disabled={clinicalNotes.trim().length < 3 || completeMutation.isPending}
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {completeMutation.isPending ? "Completing…" : "Complete visit"}
            </button>
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="text-sm text-ink-soft hover:text-critical"
            >
              Cancel appointment
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
