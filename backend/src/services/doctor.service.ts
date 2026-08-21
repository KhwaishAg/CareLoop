import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { recordAudit } from "./audit.service";

const SALT_ROUNDS = 12;

export type WorkingHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  [string, string] | []
>;

/** Admin creates a doctor account + profile together in one transaction. */
export async function createDoctor(params: {
  createdByAdminId: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  specialisation: string;
  workingHours: WorkingHours;
  slotDurationMin: number;
}) {
  const existing = await prisma.user.findUnique({ where: { email: params.email } });
  if (existing) throw new Error("EMAIL_IN_USE");

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  const doctorProfile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: params.email,
        passwordHash,
        name: params.name,
        phone: params.phone,
        role: "DOCTOR",
      },
    });

    return tx.doctorProfile.create({
      data: {
        userId: user.id,
        specialisation: params.specialisation,
        workingHours: params.workingHours,
        slotDurationMin: params.slotDurationMin,
      },
      include: { user: true },
    });
  });

  await recordAudit({
    userId: params.createdByAdminId,
    action: "ADMIN_CREATED_DOCTOR",
    entity: "DoctorProfile",
    entityId: doctorProfile.id,
    metadata: { specialisation: params.specialisation, doctorUserId: doctorProfile.userId },
  });

  return doctorProfile;
}

export async function updateDoctorProfile(params: {
  updatedByAdminId: string;
  doctorProfileId: string;
  specialisation?: string;
  workingHours?: WorkingHours;
  slotDurationMin?: number;
}) {
  const updated = await prisma.doctorProfile.update({
    where: { id: params.doctorProfileId },
    data: {
      specialisation: params.specialisation,
      workingHours: params.workingHours,
      slotDurationMin: params.slotDurationMin,
    },
    include: { user: true },
  });

  await recordAudit({
    userId: params.updatedByAdminId,
    action: "ADMIN_UPDATED_DOCTOR",
    entity: "DoctorProfile",
    entityId: updated.id,
  });

  return updated;
}

export async function listDoctors(specialisation?: string) {
  return prisma.doctorProfile.findMany({
    where: specialisation
      ? { specialisation: { contains: specialisation, mode: "insensitive" } }
      : undefined,
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { specialisation: "asc" },
  });
}

export async function getDoctorById(doctorProfileId: string) {
  return prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      leaveDays: { orderBy: { date: "asc" } },
    },
  });
}

/** Returns the doctor's own profile from their User id (used by the doctor portal). */
export async function getDoctorProfileByUserId(userId: string) {
  return prisma.doctorProfile.findUnique({
    where: { userId },
    include: { leaveDays: { orderBy: { date: "asc" } } },
  });
}

export async function addLeaveDay(params: {
  adminId: string;
  doctorProfileId: string;
  date: string; // "YYYY-MM-DD"
  reason?: string;
}) {
  const leave = await prisma.leaveDay.upsert({
    where: {
      doctorId_date: { doctorId: params.doctorProfileId, date: new Date(params.date) },
    },
    update: { reason: params.reason },
    create: {
      doctorId: params.doctorProfileId,
      date: new Date(params.date),
      reason: params.reason,
    },
  });

  await recordAudit({
    userId: params.adminId,
    action: "ADMIN_MARKED_LEAVE",
    entity: "LeaveDay",
    entityId: leave.id,
    metadata: { doctorProfileId: params.doctorProfileId, date: params.date },
  });

  return leave;
}

export async function removeLeaveDay(params: { adminId: string; leaveDayId: string }) {
  const leave = await prisma.leaveDay.delete({ where: { id: params.leaveDayId } });

  await recordAudit({
    userId: params.adminId,
    action: "ADMIN_REMOVED_LEAVE",
    entity: "LeaveDay",
    entityId: leave.id,
  });

  return leave;
}

/** Appointments affected by a leave day — used to show the admin a
 *  confirmation screen ("3 appointments will be affected") before marking
 *  leave, and again by the leave-conflict sweep in appointment.service.ts.
 */
export async function getAppointmentsAffectedByLeave(doctorUserId: string, date: string) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  return prisma.appointment.findMany({
    where: {
      doctorId: doctorUserId,
      status: "BOOKED",
      startTime: { gte: dayStart, lte: dayEnd },
    },
    include: { patient: { select: { id: true, name: true, email: true } } },
    orderBy: { startTime: "asc" },
  });
}
