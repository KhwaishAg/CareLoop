import { z } from "zod";
import { prisma } from "../lib/prisma";
import { callGemini } from "../lib/gemini";
import { detectSafetySignal } from "../utils/safetySignal";
import { llmQueue } from "../jobs/queues";

const LANGUAGE_NAMES: Record<string, string> = {
  EN: "English",
  HI: "Hindi",
  TA: "Tamil",
  TE: "Telugu",
};

// ─────────────────────────────────────────────────────────────
// Enqueue — called from appointment.service.ts, never blocks the caller
// ─────────────────────────────────────────────────────────────

export async function enqueuePreVisitSummaryJob(appointmentId: string): Promise<void> {
  await llmQueue.add("pre-visit", { appointmentId });
}

export async function enqueuePostVisitSummaryJob(appointmentId: string): Promise<void> {
  await llmQueue.add("post-visit", { appointmentId });
}

// ─────────────────────────────────────────────────────────────
// Pre-visit summary
// ─────────────────────────────────────────────────────────────

const preVisitResponseSchema = z.object({
  urgency: z.enum(["Low", "Medium", "High"]),
  urgencyFactors: z.array(z.string()).max(5),
  chiefComplaint: z.string(),
  suggestedQuestions: z.array(z.string()).length(3),
  changeFromLastVisit: z
    .object({
      newSymptoms: z.array(z.string()),
      resolvedSymptoms: z.array(z.string()),
      ongoingSymptoms: z.array(z.string()),
      summary: z.string(),
    })
    .nullable(),
});

async function buildPriorVisitContext(patientId: string, doctorId: string, excludeAppointmentId: string) {
  const priorVisits = await prisma.appointment.findMany({
    where: { patientId, doctorId, status: "COMPLETED", id: { not: excludeAppointmentId } },
    orderBy: { startTime: "desc" },
    take: 2,
    include: { symptomForm: true, visitNote: true },
  });

  if (priorVisits.length === 0) return null;

  return priorVisits
    .map((v, i) => {
      const complaint = v.symptomForm?.chiefComplaint ?? v.symptomForm?.rawSymptoms ?? "not recorded";
      const notes = v.visitNote?.clinicalNotes ?? "not recorded";
      return `Visit ${i + 1} (${v.startTime.toISOString().slice(0, 10)}): complaint — ${complaint}; doctor's notes — ${notes}`;
    })
    .join("\n");
}

const PRE_VISIT_SYSTEM_INSTRUCTION = `You are assisting a doctor with pre-visit preparation. You organize and summarize patient-submitted information — you never diagnose, never recommend treatment, and never invent symptoms not present in the input or prior visit context. Respond with ONLY valid JSON matching the requested schema, no markdown formatting, no commentary.`;

function buildPreVisitPrompt(rawSymptoms: string, priorVisitContext: string | null): string {
  return `Analyse the patient's symptoms below and return JSON with exactly these fields:
- urgency: "Low" | "Medium" | "High"
- urgencyFactors: array of short factors supporting the urgency level (not internal reasoning, just observable factors — e.g. "symptoms have persisted for several days")
- chiefComplaint: a concise, English description regardless of what language the symptoms were written in
- suggestedQuestions: exactly 3 questions a doctor might ask, informed by prior visit context if provided
- changeFromLastVisit: if prior visit context is provided, an object { newSymptoms: string[], resolvedSymptoms: string[], ongoingSymptoms: string[], summary: string }. If no prior visit context is provided, this must be null.

Prior visits with this doctor:
${priorVisitContext ?? "(none — this is the patient's first visit with this doctor)"}

Current symptoms:
${rawSymptoms}`;
}

export async function processPreVisitSummary(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { symptomForm: true, patient: true },
  });
  if (!appointment?.symptomForm) return;

  // Runs regardless of whether the LLM call below succeeds — this is the
  // whole point of the safety signal layer being separate from the model.
  const safety = detectSafetySignal(appointment.symptomForm.rawSymptoms);

  try {
    const priorVisitContext = await buildPriorVisitContext(
      appointment.patientId,
      appointment.doctorId,
      appointment.id
    );

    const raw = await callGemini({
      systemInstruction: PRE_VISIT_SYSTEM_INSTRUCTION,
      prompt: buildPreVisitPrompt(appointment.symptomForm.rawSymptoms, priorVisitContext),
    });

    const parsed = preVisitResponseSchema.parse(raw);

    // The safety signal layer overrides the model's urgency, never the
    // reverse — a keyword match forces High regardless of what the LLM says.
    const finalUrgency = safety.flagged ? "High" : parsed.urgency;

    await prisma.symptomForm.update({
      where: { appointmentId },
      data: {
        safetySignalFlagged: safety.flagged,
        safetySignalReason: safety.reason,
        urgency: finalUrgency,
        urgencyFactors: parsed.urgencyFactors,
        chiefComplaint: parsed.chiefComplaint,
        suggestedQuestions: parsed.suggestedQuestions,
        changeFromLastVisit: parsed.changeFromLastVisit ?? undefined,
        status: "READY",
      },
    });
  } catch (err) {
    console.error(`[llm] pre-visit summary failed for appointment ${appointmentId}`, err);
    // Graceful degradation: the safety signal result is still recorded even
    // though the LLM call failed, and urgency falls back to High if the
    // deterministic layer flagged something — the doctor is never worse
    // off than before this feature existed, and never silently under-warned.
    await prisma.symptomForm.update({
      where: { appointmentId },
      data: {
        safetySignalFlagged: safety.flagged,
        safetySignalReason: safety.reason,
        urgency: safety.flagged ? "High" : undefined,
        status: "FAILED",
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Post-visit summary
// ─────────────────────────────────────────────────────────────

const postVisitResponseSchema = z.object({
  summary: z.string(),
  medicationSchedule: z.string(),
  followUpSteps: z.string(),
});

const POST_VISIT_SYSTEM_INSTRUCTION = `You convert clinical notes into a patient-friendly summary. You only summarize information present in the notes — you never add, remove, or modify medication details, and you never present this as medical advice beyond what the doctor wrote. Respond with ONLY valid JSON matching the requested schema, no markdown formatting, no commentary.`;

function buildPostVisitPrompt(clinicalNotes: string, patientLanguage: string): string {
  const languageName = LANGUAGE_NAMES[patientLanguage] ?? "English";
  return `Convert these clinical notes into a patient-friendly summary written in ${languageName}. Return JSON with exactly these fields:
- summary: string — what the doctor found/assessed, in plain language
- medicationSchedule: string — medication and dosing exactly as written in the notes, just phrased clearly
- followUpSteps: string — what the patient should do next

Clinical notes:
${clinicalNotes}`;
}

export async function processPostVisitSummary(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { visitNote: true, patient: true },
  });
  if (!appointment?.visitNote) return;

  try {
    const raw = await callGemini({
      systemInstruction: POST_VISIT_SYSTEM_INSTRUCTION,
      prompt: buildPostVisitPrompt(appointment.visitNote.clinicalNotes, appointment.patient.preferredLanguage),
    });

    const parsed = postVisitResponseSchema.parse(raw);

    await prisma.visitNote.update({
      where: { appointmentId },
      data: {
        patientSummary: parsed.summary,
        medicationSchedule: parsed.medicationSchedule,
        followUpSteps: parsed.followUpSteps,
        status: "READY",
      },
    });
  } catch (err) {
    console.error(`[llm] post-visit summary failed for appointment ${appointmentId}`, err);
    // The doctor's original clinical notes are untouched and remain visible
    // to the patient's care team either way — a failed summary never hides
    // the underlying record, it just doesn't get a patient-friendly version yet.
    await prisma.visitNote.update({
      where: { appointmentId },
      data: { status: "FAILED" },
    });
  }
}
