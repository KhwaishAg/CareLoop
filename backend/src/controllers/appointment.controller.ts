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
  AppointmentError,
} from "../services/appointment.service";

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
    },
    orderBy: { startTime: "desc" },
  });

  return res.json({ appointments });
}
