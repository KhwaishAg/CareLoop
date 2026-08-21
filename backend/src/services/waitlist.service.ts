import { prisma } from "../lib/prisma";
import { holdSlot } from "./appointment.service";
import { recordAudit } from "./audit.service";
import { enqueueWaitlistOffer } from "./notification.service";

export async function joinWaitlist(params: {
  patientId: string;
  doctorId: string; // doctor's User id — kept consistent with Appointment.doctorId
  preferredDate: string; // "YYYY-MM-DD"
  preferredStartTime: string; // "HH:MM"
  preferredEndTime: string; // "HH:MM"
}) {
  const entry = await prisma.waitlist.create({
    data: {
      patientId: params.patientId,
      doctorId: params.doctorId,
      preferredDate: new Date(`${params.preferredDate}T00:00:00.000Z`),
      preferredStartTime: params.preferredStartTime,
      preferredEndTime: params.preferredEndTime,
    },
  });

  await recordAudit({
    userId: params.patientId,
    action: "PATIENT_JOINED_WAITLIST",
    entity: "Waitlist",
    entityId: entry.id,
  });

  return entry;
}

/**
 * Called whenever a slot frees up (cancellation or a leave sweep). Only
 * offers the slot to waitlist entries whose time window actually contains
 * it — "any slot Tuesday" and "specifically 5–7pm Tuesday" are different
 * requests, and offering the wrong one defeats the point of a "smart"
 * waitlist. Earliest-joined match wins; the slot is held (not booked
 * outright) under the same partial-index protection as any other hold,
 * so it can't be double-claimed, and an email with a time-boxed link goes
 * out for the patient to confirm.
 */
export async function offerFreedSlotToWaitlist(params: {
  doctorProfileId: string;
  doctorUserId: string;
  slotStart: Date;
}): Promise<void> {
  const dateStr = params.slotStart.toISOString().slice(0, 10);
  const timeStr = params.slotStart.toISOString().slice(11, 16);

  const candidates = await prisma.waitlist.findMany({
    where: {
      doctorId: params.doctorUserId,
      status: "WAITING",
      preferredDate: new Date(`${dateStr}T00:00:00.000Z`),
      preferredStartTime: { lte: timeStr },
      preferredEndTime: { gte: timeStr },
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidates.length === 0) return;
  const match = candidates[0];

  let held;
  try {
    held = await holdSlot({
      patientId: match.patientId,
      doctorProfileId: params.doctorProfileId,
      startTime: params.slotStart.toISOString(),
    });
  } catch {
    // Someone else (a regular booking, or a faster waitlist offer for a
    // different window that happens to overlap) took it first — nothing
    // to offer anymore, leave this candidate WAITING for the next opening.
    return;
  }

  await prisma.waitlist.update({ where: { id: match.id }, data: { status: "OFFERED" } });

  // Follows the same Notification-row-first pattern as every other email in
  // this system — held.id is a real Appointment row, so buildEmailContent
  // can load it exactly like any other notification.
  await enqueueWaitlistOffer(held.id, match.patientId);

  await recordAudit({
    userId: match.patientId,
    action: "WAITLIST_SLOT_OFFERED",
    entity: "Waitlist",
    entityId: match.id,
    metadata: { appointmentId: held.id },
  });
}
