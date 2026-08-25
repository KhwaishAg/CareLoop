import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { holdExpiryQueue, calendarQueue } from "../jobs/queues";
import { recordAudit } from "./audit.service";
import { generateSlotBoundaries, isOnGeneratedBoundary } from "../utils/slots";
import type { WorkingHours } from "./doctor.service";
import { enqueuePreVisitSummaryJob, enqueuePostVisitSummaryJob } from "./llm.service";
import { createMedication } from "./medication.service";
import type { FrequencyType } from "@prisma/client";
import {
  enqueueBookingConfirmation,
  enqueueCancellationNotice,
  enqueueLeaveNotice,
} from "./notification.service";

class AppointmentError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────
// Slot search
// ─────────────────────────────────────────────────────────────

export async function getAvailableSlots(doctorProfileId: string, date: string) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
  if (!doctorProfile) throw new AppointmentError("Doctor not found", 404);

  const onLeave = await prisma.leaveDay.findUnique({
    where: { doctorId_date: { doctorId: doctorProfileId, date: new Date(`${date}T00:00:00.000Z`) } },
  });
  if (onLeave) return { slots: [], onLeave: true };

  const boundaries = generateSlotBoundaries(
    doctorProfile.workingHours as unknown as WorkingHours,
    doctorProfile.slotDurationMin,
    date
  );

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const now = new Date();

  // HELD rows past their own expiry haven't necessarily been swept by the
  // worker yet — treat them as available rather than trusting the status
  // column alone, so a slow worker never blocks a real booking.
  const taken = await prisma.appointment.findMany({
    where: {
      doctorId: doctorProfile.userId,
      startTime: { gte: dayStart, lte: dayEnd },
      OR: [{ status: "BOOKED" }, { status: "HELD", holdExpiresAt: { gt: now } }],
    },
    select: { startTime: true },
  });
  const takenTimes = new Set(taken.map((t) => t.startTime.getTime()));

  const slots = boundaries
    .filter((b) => !takenTimes.has(b.getTime()))
    .map((b) => ({
      startTime: b.toISOString(),
      endTime: new Date(b.getTime() + doctorProfile.slotDurationMin * 60_000).toISOString(),
    }));

  return { slots, onLeave: false };
}

// ─────────────────────────────────────────────────────────────
// Hold → confirm (the double-booking-safe booking flow)
// ─────────────────────────────────────────────────────────────

export async function holdSlot(params: {
  patientId: string;
  doctorProfileId: string;
  startTime: string; // ISO
  rescheduledFromId?: string;
}) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: params.doctorProfileId } });
  if (!doctorProfile) throw new AppointmentError("Doctor not found", 404);

  const start = new Date(params.startTime);
  const workingHours = doctorProfile.workingHours as unknown as WorkingHours;

  if (!isOnGeneratedBoundary(workingHours, doctorProfile.slotDurationMin, start)) {
    throw new AppointmentError(
      "That time isn't a valid slot for this doctor — please pick from the available slots list",
      400
    );
  }

  const dateStr = start.toISOString().slice(0, 10);
  const onLeave = await prisma.leaveDay.findUnique({
    where: { doctorId_date: { doctorId: params.doctorProfileId, date: new Date(`${dateStr}T00:00:00.000Z`) } },
  });
  if (onLeave) throw new AppointmentError("The doctor is on leave that day", 409);

  const end = new Date(start.getTime() + doctorProfile.slotDurationMin * 60_000);
  const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_MINUTES * 60_000);

  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: {
        patientId: params.patientId,
        doctorId: doctorProfile.userId,
        startTime: start,
        endTime: end,
        status: "HELD",
        holdExpiresAt,
        rescheduledFromId: params.rescheduledFromId,
      },
    });
  } catch (err) {
    // The partial unique index (doctorId, startTime) WHERE status IN
    // (HELD, BOOKED) is what actually prevents the race — this catch is
    // just translating the resulting Postgres error into a clean response.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppointmentError("Sorry, this slot was just taken by another patient", 409);
    }
    throw err;
  }

  // jobId = appointmentId makes this idempotent: if holdSlot were somehow
  // called twice for the same row (it can't be, thanks to the index above,
  // but defensively) BullMQ would just no-op the duplicate add.
  await holdExpiryQueue.add(
    "expire",
    { appointmentId: appointment.id },
    { delay: env.SLOT_HOLD_MINUTES * 60_000, jobId: appointment.id }
  );

  await recordAudit({
    userId: params.patientId,
    action: "PATIENT_HELD_SLOT",
    entity: "Appointment",
    entityId: appointment.id,
  });

  return appointment;
}

export async function confirmBooking(params: {
  appointmentId: string;
  patientId: string;
  rawSymptoms: string;
  language: "EN" | "HI" | "TA" | "TE";
}) {
  const appointment = await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findUnique({ where: { id: params.appointmentId } });
    if (!existing || existing.patientId !== params.patientId) {
      throw new AppointmentError("Appointment not found", 404);
    }
    if (existing.status !== "HELD") {
      throw new AppointmentError("This slot hold is no longer active", 409);
    }
    if (existing.holdExpiresAt && existing.holdExpiresAt < new Date()) {
      throw new AppointmentError("Your slot hold expired — please pick a slot again", 410);
    }

    const updated = await tx.appointment.update({
      where: { id: params.appointmentId },
      data: { status: "BOOKED", holdExpiresAt: null },
    });

    await tx.symptomForm.create({
      data: {
        appointmentId: updated.id,
        rawSymptoms: params.rawSymptoms,
        language: params.language,
      },
    });

    return updated;
  });

  // Booking is committed before either of these — a slow/failed LLM call
  // or a slow/failed email send never blocks or unwinds the booking itself.
  const holdJob = await holdExpiryQueue.getJob(appointment.id);
  if (holdJob) await holdJob.remove();

  await enqueuePreVisitSummaryJob(appointment.id);
  await enqueueBookingConfirmation(appointment.id);
  await calendarQueue.add("sync", { appointmentId: appointment.id, action: "create" });

  await recordAudit({
    userId: params.patientId,
    action: "PATIENT_BOOKED_APPOINTMENT",
    entity: "Appointment",
    entityId: appointment.id,
  });

  return appointment;
}

// ─────────────────────────────────────────────────────────────
// Cancel / reschedule
// ─────────────────────────────────────────────────────────────

export async function cancelAppointment(params: {
  appointmentId: string;
  actingUserId: string;
  reason?: "PATIENT_CANCELLED" | "DOCTOR_LEAVE";
}) {
  const existing = await prisma.appointment.findUnique({ where: { id: params.appointmentId } });
  if (!existing) throw new AppointmentError("Appointment not found", 404);
  if (existing.status === "COMPLETED") {
    throw new AppointmentError("A completed appointment can't be cancelled", 409);
  }
  if (existing.status === "CANCELLED") {
    return existing; // already cancelled — idempotent no-op
  }

  const cancelled = await prisma.appointment.update({
    where: { id: params.appointmentId },
    data: { status: "CANCELLED", cancelReason: params.reason ?? "PATIENT_CANCELLED", holdExpiresAt: null },
  });

  const holdJob = await holdExpiryQueue.getJob(params.appointmentId);
  if (holdJob) await holdJob.remove();

  await enqueueCancellationNotice(cancelled.id, cancelled.cancelReason ?? "PATIENT_CANCELLED");
  await calendarQueue.add("sync", { appointmentId: cancelled.id, action: "delete" });
  await offerToWaitlist(cancelled.doctorId, cancelled.startTime);

  await recordAudit({
    userId: params.actingUserId,
    action: "PATIENT_CANCELLED_APPOINTMENT",
    entity: "Appointment",
    entityId: cancelled.id,
  });

  return cancelled;
}

export async function rescheduleAppointment(params: {
  originalAppointmentId: string;
  patientId: string;
  newStartTime: string;
  doctorProfileId: string;
}) {
  const original = await prisma.appointment.findUnique({
    where: { id: params.originalAppointmentId },
    include: { symptomForm: true },
  });
  if (!original || original.patientId !== params.patientId) {
    throw new AppointmentError("Appointment not found", 404);
  }
  if (original.status !== "BOOKED") {
    throw new AppointmentError("Only a booked appointment can be rescheduled", 409);
  }

  // Hold the new slot first — if it's taken, the original booking is left
  // completely untouched rather than cancelling before knowing the new
  // time actually succeeded.
  const held = await holdSlot({
    patientId: params.patientId,
    doctorProfileId: params.doctorProfileId,
    startTime: params.newStartTime,
    rescheduledFromId: original.id,
  });

  const rebooked = await confirmBooking({
    appointmentId: held.id,
    patientId: params.patientId,
    rawSymptoms: original.symptomForm?.rawSymptoms ?? "",
    language: (original.symptomForm?.language as any) ?? "EN",
  });

  await cancelAppointment({
    appointmentId: original.id,
    actingUserId: params.patientId,
    reason: "PATIENT_CANCELLED",
  });
  // Overwrite the generic cancel reason set above with the specific one —
  // cancelAppointment() doesn't know about reschedules, so it's corrected here.
  await prisma.appointment.update({
    where: { id: original.id },
    data: { cancelReason: "RESCHEDULED" },
  });

  return rebooked;
}

// ─────────────────────────────────────────────────────────────
// Completing a visit — doctor submits clinical notes (+ optional follow-up
// date), which both marks the appointment COMPLETED and triggers the
// post-visit LLM summary. Prescriptions/medications are handled separately
// in the medication-reminders build phase (task 9), which owns that table.
// ─────────────────────────────────────────────────────────────

export interface PrescribedMedication {
  name: string;
  dosage: string;
  frequencyType: FrequencyType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  instructions?: string;
}

export async function completeVisit(params: {
  appointmentId: string;
  doctorId: string;
  clinicalNotes: string;
  recommendedFollowUpDate?: string; // "YYYY-MM-DD"
  medications?: PrescribedMedication[];
}) {
  const existing = await prisma.appointment.findUnique({ where: { id: params.appointmentId } });
  if (!existing || existing.doctorId !== params.doctorId) {
    throw new AppointmentError("Appointment not found", 404);
  }
  if (existing.status !== "BOOKED") {
    throw new AppointmentError("Only a booked appointment can be completed", 409);
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: params.appointmentId },
      data: {
        status: "COMPLETED",
        recommendedFollowUpDate: params.recommendedFollowUpDate
          ? new Date(params.recommendedFollowUpDate)
          : undefined,
      },
    });

    await tx.visitNote.upsert({
      where: { appointmentId: updated.id },
      update: { clinicalNotes: params.clinicalNotes, status: "PENDING" },
      create: { appointmentId: updated.id, clinicalNotes: params.clinicalNotes },
    });

    return updated;
  });

  await enqueuePostVisitSummaryJob(appointment.id);

  // Medications are created after the transaction commits, not inside it —
  // each one also schedules a BullMQ delayed job, and a job scheduling
  // failure should never unwind an otherwise-successful visit completion.
  for (const med of params.medications ?? []) {
    await createMedication({ appointmentId: appointment.id, ...med });
  }

  await recordAudit({
    userId: params.doctorId,
    action: "DOCTOR_COMPLETED_VISIT",
    entity: "Appointment",
    entityId: appointment.id,
  });

  return appointment;
}

// ─────────────────────────────────────────────────────────────
// Leave-conflict sweep — called by adminAddLeave after the LeaveDay itself
// is recorded (see doctor.controller.ts)
// ─────────────────────────────────────────────────────────────

export async function applyLeaveConflicts(params: {
  doctorUserId: string;
  date: string; // "YYYY-MM-DD"
  adminId: string;
}) {
  const dayStart = new Date(`${params.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${params.date}T23:59:59.999Z`);

  const affected = await prisma.appointment.findMany({
    where: { doctorId: params.doctorUserId, status: "BOOKED", startTime: { gte: dayStart, lte: dayEnd } },
  });

  for (const appt of affected) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "CANCELLED", cancelReason: "DOCTOR_LEAVE" },
    });
    await enqueueLeaveNotice(appt.id);
    await calendarQueue.add("sync", { appointmentId: appt.id, action: "delete" });
    await offerToWaitlist(appt.doctorId, appt.startTime);
    await recordAudit({
      userId: params.adminId,
      action: "ADMIN_LEAVE_CANCELLED_APPOINTMENT",
      entity: "Appointment",
      entityId: appt.id,
    });
    // TODO (task 10): offer the freed slot to the time-window-matched waitlist
  }

  return affected.length;
}

/**
 * Lazily imported — waitlist.service.ts imports holdSlot from this file,
 * so a static top-level import here would create a circular require.
 * Deferring it to call time avoids that without a bigger restructure.
 */
async function offerToWaitlist(doctorUserId: string, slotStart: Date) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: doctorUserId } });
  if (!doctorProfile) return;

  const { offerFreedSlotToWaitlist } = await import("./waitlist.service.js");
  await offerFreedSlotToWaitlist({
    doctorProfileId: doctorProfile.id,
    doctorUserId,
    slotStart,
  });
}

export { AppointmentError };
