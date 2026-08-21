import { prisma } from "../lib/prisma";

export type FollowUpStatus = "NONE" | "SCHEDULED" | "ON_TRACK" | "DUE_SOON" | "OVERDUE";

const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Purely deterministic — no LLM involved. Compares the doctor's recorded
 * recommendedFollowUpDate against whether the patient actually has a later
 * appointment with the same doctor.
 */
export async function getFollowUpStatus(appointmentId: string): Promise<{
  status: FollowUpStatus;
  recommendedFollowUpDate: Date | null;
  nextAppointmentId: string | null;
}> {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment?.recommendedFollowUpDate) {
    return { status: "NONE", recommendedFollowUpDate: null, nextAppointmentId: null };
  }

  const nextAppointment = await prisma.appointment.findFirst({
    where: {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      startTime: { gt: appointment.startTime },
      status: { in: ["BOOKED", "COMPLETED"] },
    },
    orderBy: { startTime: "asc" },
  });

  if (nextAppointment) {
    return {
      status: "SCHEDULED",
      recommendedFollowUpDate: appointment.recommendedFollowUpDate,
      nextAppointmentId: nextAppointment.id,
    };
  }

  const daysUntilDue =
    (appointment.recommendedFollowUpDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  const status: FollowUpStatus =
    daysUntilDue < 0 ? "OVERDUE" : daysUntilDue <= DUE_SOON_WINDOW_DAYS ? "DUE_SOON" : "ON_TRACK";

  return { status, recommendedFollowUpDate: appointment.recommendedFollowUpDate, nextAppointmentId: null };
}

/** Rollup for a doctor's (or admin's) dashboard — every completed visit
 *  that recommended a follow-up and doesn't have one scheduled yet,
 *  ordered so overdue patients surface first. */
export async function getFollowUpRollup(doctorId?: string) {
  const candidates = await prisma.appointment.findMany({
    where: {
      status: "COMPLETED",
      recommendedFollowUpDate: { not: null },
      ...(doctorId ? { doctorId } : {}),
    },
    include: { patient: { select: { id: true, name: true } }, doctor: { select: { id: true, name: true } } },
    orderBy: { recommendedFollowUpDate: "asc" },
  });

  const results = await Promise.all(
    candidates.map(async (appt) => ({
      appointment: appt,
      ...(await getFollowUpStatus(appt.id)),
    }))
  );

  const statusOrder: Record<FollowUpStatus, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    ON_TRACK: 2,
    SCHEDULED: 3,
    NONE: 4,
  };

  return results
    .filter((r) => r.status === "OVERDUE" || r.status === "DUE_SOON" || r.status === "ON_TRACK")
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}
