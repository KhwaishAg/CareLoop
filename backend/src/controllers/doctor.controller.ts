import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import {
  createDoctor,
  updateDoctorProfile,
  listDoctors,
  getDoctorById,
  getDoctorProfileByUserId,
  addLeaveDay,
  removeLeaveDay,
  getAppointmentsAffectedByLeave,
} from "../services/doctor.service";
import { applyLeaveConflicts } from "../services/appointment.service";
import { prisma } from "../lib/prisma";

const daySchema = z.union([
  z.tuple([z.string(), z.string()]),
  z.tuple([]),
]);

const workingHoursSchema = z.object({
  mon: daySchema,
  tue: daySchema,
  wed: daySchema,
  thu: daySchema,
  fri: daySchema,
  sat: daySchema,
  sun: daySchema,
});

const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
  specialisation: z.string().min(1),
  workingHours: workingHoursSchema,
  slotDurationMin: z.number().int().min(5).max(240).default(30),
});

const updateDoctorSchema = z.object({
  specialisation: z.string().min(1).optional(),
  workingHours: workingHoursSchema.optional(),
  slotDurationMin: z.number().int().min(5).max(240).optional(),
});

const leaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  reason: z.string().optional(),
});

export async function adminCreateDoctor(req: AuthedRequest, res: Response) {
  const parsed = createDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const doctor = await createDoctor({ createdByAdminId: req.user!.id, ...parsed.data });
    return res.status(201).json({ doctor });
  } catch (err: any) {
    if (err.message === "EMAIL_IN_USE") {
      return res.status(409).json({ error: "A doctor with this email already exists" });
    }
    console.error("[doctor] create failed", err);
    return res.status(500).json({ error: "Could not create doctor" });
  }
}

export async function adminUpdateDoctor(req: AuthedRequest, res: Response) {
  const parsed = updateDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const doctor = await updateDoctorProfile({
      updatedByAdminId: req.user!.id,
      doctorProfileId: req.params.id,
      ...parsed.data,
    });
    return res.json({ doctor });
  } catch (err) {
    console.error("[doctor] update failed", err);
    return res.status(404).json({ error: "Doctor not found" });
  }
}

export async function listDoctorsHandler(req: AuthedRequest, res: Response) {
  const specialisation = typeof req.query.specialisation === "string" ? req.query.specialisation : undefined;
  const doctors = await listDoctors(specialisation);
  return res.json({ doctors });
}

export async function getDoctorHandler(req: AuthedRequest, res: Response) {
  const doctor = await getDoctorById(req.params.id);
  if (!doctor) return res.status(404).json({ error: "Doctor not found" });
  return res.json({ doctor });
}

export async function getMyDoctorProfile(req: AuthedRequest, res: Response) {
  const profile = await getDoctorProfileByUserId(req.user!.id);
  if (!profile) return res.status(404).json({ error: "No doctor profile for this account" });
  return res.json({ doctor: profile });
}

/** Preview which appointments a leave date would affect, WITHOUT committing
 *  the leave yet — powers the admin confirmation screen from the blueprint
 *  ("3 appointments will be affected") before anything is cancelled. */
export async function previewLeaveImpact(req: AuthedRequest, res: Response) {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
  if (!doctorProfile) return res.status(404).json({ error: "Doctor not found" });

  const affected = await getAppointmentsAffectedByLeave(doctorProfile.userId, parsed.data.date);
  return res.json({ affectedAppointments: affected, count: affected.length });
}

export async function adminAddLeave(req: AuthedRequest, res: Response) {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: req.params.id } });
    if (!doctorProfile) return res.status(404).json({ error: "Doctor not found" });

    const leave = await addLeaveDay({
      adminId: req.user!.id,
      doctorProfileId: req.params.id,
      date: parsed.data.date,
      reason: parsed.data.reason,
    });

    // Cancel any already-booked appointments on this date and fan out
    // notifications — the admin should have already seen this exact list
    // via POST /doctors/:id/leave/preview before confirming.
    const affectedCount = await applyLeaveConflicts({
      doctorUserId: doctorProfile.userId,
      date: parsed.data.date,
      adminId: req.user!.id,
    });

    return res.status(201).json({ leave, affectedAppointments: affectedCount });
  } catch (err) {
    console.error("[doctor] add leave failed", err);
    return res.status(500).json({ error: "Could not add leave day" });
  }
}

export async function adminRemoveLeave(req: AuthedRequest, res: Response) {
  try {
    await removeLeaveDay({ adminId: req.user!.id, leaveDayId: req.params.leaveId });
    return res.status(204).send();
  } catch (err) {
    console.error("[doctor] remove leave failed", err);
    return res.status(404).json({ error: "Leave day not found" });
  }
}
