import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import {
  getAvailableSlots,
  holdSlot,
  confirmBooking,
  cancelAppointment,
  rescheduleAppointment,
  completeVisit,
  AppointmentError,
} from "../services/appointment.service";
import { getFollowUpStatus, getFollowUpRollup } from "../services/followup.service";
import { assistSymptomDescription, SymptomTooShortError } from "../services/llm.service";
import { LlmNotConfiguredError, LlmCallFailedError } from "../lib/gemini";

const holdSchema = z.object({
  doctorProfileId: z.string().min(1),
  startTime: z.string().datetime(),
});

const confirmSchema = z.object({
  rawSymptoms: z.string().min(3, "Please describe your symptoms"),
  language: z.enum(["EN", "HI", "TA", "TE"]).default("EN"),
});

const rescheduleSchema = z.object({
  doctorProfileId: z.string().min(1),
  newStartTime: z.string().datetime(),
});

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequencyType: z.enum([
    "ONCE_DAILY",
    "TWICE_DAILY",
    "THRICE_DAILY",
    "EVERY_6_HOURS",
    "EVERY_8_HOURS",
    "EVERY_12_HOURS",
    "AS_NEEDED",
  ]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructions: z.string().optional(),
});

const completeVisitSchema = z.object({
  clinicalNotes: z.string().min(3, "Clinical notes can't be empty"),
  recommendedFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  medications: z.array(medicationSchema).optional(),
});

const symptomAssistSchema = z.object({
  rawSymptoms: z.string().min(1),
  language: z.enum(["EN", "HI", "TA", "TE"]).default("EN"),
});

function handleAppointmentError(err: unknown, res: Response) {
  if (err instanceof AppointmentError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error("[appointment]", err);
  return res.status(500).json({ error: "Something went wrong" });
}

export async function getSlots(req: AuthedRequest, res: Response) {
  const { doctorProfileId, date } = req.query;
  if (typeof doctorProfileId !== "string" || typeof date !== "string") {
    return res.status(400).json({ error: "doctorProfileId and date are required" });
  }
  try {
    const result = await getAvailableSlots(doctorProfileId, date);
    return res.json(result);
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function hold(req: AuthedRequest, res: Response) {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const appointment = await holdSlot({
      patientId: req.user!.id,
      doctorProfileId: parsed.data.doctorProfileId,
      startTime: parsed.data.startTime,
    });
    return res.status(201).json({ appointment });
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function confirm(req: AuthedRequest, res: Response) {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const appointment = await confirmBooking({
      appointmentId: req.params.id,
      patientId: req.user!.id,
      rawSymptoms: parsed.data.rawSymptoms,
      language: parsed.data.language,
    });
    return res.json({ appointment });
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function cancel(req: AuthedRequest, res: Response) {
  try {
    const appointment = await cancelAppointment({
      appointmentId: req.params.id,
      actingUserId: req.user!.id,
    });
    return res.json({ appointment });
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function reschedule(req: AuthedRequest, res: Response) {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const appointment = await rescheduleAppointment({
      originalAppointmentId: req.params.id,
      patientId: req.user!.id,
      newStartTime: parsed.data.newStartTime,
      doctorProfileId: parsed.data.doctorProfileId,
    });
    return res.json({ appointment });
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function complete(req: AuthedRequest, res: Response) {
  const parsed = completeVisitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const appointment = await completeVisit({
      appointmentId: req.params.id,
      doctorId: req.user!.id,
      clinicalNotes: parsed.data.clinicalNotes,
      recommendedFollowUpDate: parsed.data.recommendedFollowUpDate,
      medications: parsed.data.medications,
    });
    return res.json({ appointment });
  } catch (err) {
    return handleAppointmentError(err, res);
  }
}

export async function followUpStatus(req: AuthedRequest, res: Response) {
  const result = await getFollowUpStatus(req.params.id);
  return res.json(result);
}

/** Doctor sees their own rollup; admin can see everyone's by omitting the filter. */
export async function followUpRollup(req: AuthedRequest, res: Response) {
  const doctorId = req.user!.role === "DOCTOR" ? req.user!.id : undefined;
  const rollup = await getFollowUpRollup(doctorId);
  return res.json({ rollup });
}

/** Called from the booking form's "Help me phrase this" button — a
 *  synchronous, user-triggered Gemini call so the patient sees a result
 *  while they're still on the page, not a background job. Never touches
 *  the DB; failures are reported plainly so the patient can just keep
 *  typing their own version instead. */
export async function symptomAssist(req: AuthedRequest, res: Response) {
  const parsed = symptomAssistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const result = await assistSymptomDescription(parsed.data.rawSymptoms, parsed.data.language);
    return res.json(result);
  } catch (err) {
    if (err instanceof SymptomTooShortError) {
      return res.status(400).json({ error: "Write a few words about what's going on first." });
    }
    if (err instanceof LlmNotConfiguredError) {
      return res.status(503).json({ error: "AI assist isn't set up on this server yet." });
    }
    if (err instanceof LlmCallFailedError) {
      console.error("[llm] symptom assist failed", err.message);
      return res.status(502).json({ error: "AI assist is having trouble right now — try again in a moment." });
    }
    console.error("[llm] symptom assist unexpected error", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}

/** Patient's own appointments, or a doctor's own schedule — same endpoint,
 *  scoped by the caller's role. */
export async function listMyAppointments(req: AuthedRequest, res: Response) {
  const { id, role } = req.user!;

  const appointments = await prisma.appointment.findMany({
    where: role === "DOCTOR" ? { doctorId: id } : { patientId: id },
    include: {
      patient: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
      symptomForm: true,
      visitNote: true,
      medications: true,
    },
    orderBy: { startTime: "desc" },
  });

  return res.json({ appointments });
}
