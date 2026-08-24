import type { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notificationQueue, jobDefaults } from "../jobs/queues";
import { env } from "../lib/env";

const REMINDER_LEAD_TIME_MS = 24 * 60 * 60 * 1000; // 24h before the appointment

/**
 * Writes the Notification row FIRST (status PENDING), then enqueues the
 * job — the row is the audit trail and recovery point, the queue is just
 * the delivery mechanism. idempotencyKey is both the DB unique constraint
 * and the BullMQ jobId, so calling this twice for the same logical
 * notification never creates two rows or two competing jobs.
 *
 * Honest limitation, documented rather than hidden: if the worker sends
 * the email successfully but crashes in the instant before writing SENT
 * back to the DB, a retry could still double-send — no email provider on
 * the free tier here offers true idempotent delivery. What this DOES
 * reliably prevent: duplicate Notification rows, duplicate queued jobs,
 * and re-sending anything already marked SENT.
 */
async function enqueue(params: {
  userId: string;
  appointmentId: string;
  type: NotificationType;
  delayMs?: number;
}) {
  const idempotencyKey = `${params.type}:${params.appointmentId}:${params.userId}`;

  const notification = await prisma.notification.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      userId: params.userId,
      appointmentId: params.appointmentId,
      type: params.type,
      channel: "EMAIL",
      idempotencyKey,
    },
  });

  if (notification.status === "SENT") return;

  // BullMQ rejects ":" in a custom job id, so the DB's idempotencyKey
  // (which needs to stay readable, hence the colons) isn't reused verbatim
  // here — same uniqueness, just underscore-separated.
  const jobId = idempotencyKey.replace(/:/g, "_");

  await notificationQueue.add(
    params.type,
    { notificationId: notification.id },
    { jobId, delay: params.delayMs, ...jobDefaults }
  );
}

export async function enqueueBookingConfirmation(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return;
  await enqueue({ userId: appt.patientId, appointmentId, type: "BOOKING_CONFIRMATION" });
  await enqueue({ userId: appt.doctorId, appointmentId, type: "BOOKING_CONFIRMATION" });

  const reminderAt = appt.startTime.getTime() - REMINDER_LEAD_TIME_MS;
  const delayMs = Math.max(0, reminderAt - Date.now());
  // If the appointment is already less than 24h out, this fires almost
  // immediately rather than being skipped — a same-day booking should
  // still get a reminder, just not a full day ahead of time.
  await enqueue({ userId: appt.patientId, appointmentId, type: "APPOINTMENT_REMINDER", delayMs });
}

export async function enqueueCancellationNotice(appointmentId: string, _reason: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return;
  await enqueue({ userId: appt.patientId, appointmentId, type: "CANCELLATION" });
  await enqueue({ userId: appt.doctorId, appointmentId, type: "CANCELLATION" });
}

export async function enqueueLeaveNotice(appointmentId: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return;
  await enqueue({ userId: appt.patientId, appointmentId, type: "LEAVE_NOTICE" });
}

/** appointmentId here is the newly-HELD appointment created for the
 *  waitlist offer, not the original cancelled one. */
export async function enqueueWaitlistOffer(appointmentId: string, patientId: string): Promise<void> {
  await enqueue({ userId: patientId, appointmentId, type: "WAITLIST_OFFER" });
}

// ─────────────────────────────────────────────────────────────
// Email content — built at send time (not enqueue time) by the worker,
// so it always reflects the latest appointment state.
// ─────────────────────────────────────────────────────────────

export async function buildEmailContent(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: true },
  });
  if (!notification || !notification.appointmentId) return null;

  const appointment = await prisma.appointment.findUnique({
    where: { id: notification.appointmentId },
    include: { patient: true, doctor: true },
  });
  if (!appointment) return null;

  const recipient = notification.user;
  const isDoctor = recipient.id === appointment.doctorId;
  const when = appointment.startTime.toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const templates: Partial<Record<NotificationType, () => { subject: string; html: string }>> = {
    BOOKING_CONFIRMATION: () => ({
      subject: isDoctor ? `New appointment: ${appointment.patient.name}` : `Appointment confirmed — ${when}`,
      html: isDoctor
        ? `<p>Hi Dr. ${appointment.doctor.name},</p><p>A new appointment with <strong>${appointment.patient.name}</strong> is confirmed for <strong>${when}</strong>.</p>`
        : `<p>Hi ${appointment.patient.name},</p><p>Your appointment with <strong>Dr. ${appointment.doctor.name}</strong> is confirmed for <strong>${when}</strong>.</p><p>You'll get a reminder closer to the time.</p>`,
    }),
    APPOINTMENT_REMINDER: () => ({
      subject: `Reminder: your appointment is coming up — ${when}`,
      html: `<p>Hi ${appointment.patient.name},</p><p>This is a reminder for your appointment with <strong>Dr. ${appointment.doctor.name}</strong> on <strong>${when}</strong>.</p>`,
    }),
    CANCELLATION: () => ({
      subject: `Appointment cancelled — ${when}`,
      html: isDoctor
        ? `<p>Hi Dr. ${appointment.doctor.name},</p><p>The appointment with ${appointment.patient.name} on <strong>${when}</strong> has been cancelled (${appointment.cancelReason ?? "no reason given"}).</p>`
        : `<p>Hi ${appointment.patient.name},</p><p>Your appointment with Dr. ${appointment.doctor.name} on <strong>${when}</strong> has been cancelled${
            appointment.cancelReason === "DOCTOR_LEAVE" ? " because the doctor is on leave that day" : ""
          }. Please book a new slot at your convenience.</p>`,
    }),
    LEAVE_NOTICE: () => ({
      subject: `Your appointment needs to be rescheduled`,
      html: `<p>Hi ${appointment.patient.name},</p><p>Unfortunately Dr. ${appointment.doctor.name} is unavailable on <strong>${when}</strong> and your appointment has been cancelled. Please book a new slot — we're sorry for the inconvenience.</p>`,
    }),
    WAITLIST_OFFER: () => ({
      subject: `A slot just opened up — ${when}`,
      html: `<p>Hi ${appointment.patient.name},</p><p>A slot with <strong>Dr. ${appointment.doctor.name}</strong> on <strong>${when}</strong> just opened up and it's held for you.</p><p>Log in within the next <strong>${env.SLOT_HOLD_MINUTES} minutes</strong> to confirm it, or it'll be offered to the next patient on the waitlist.</p>`,
    }),
  };

  const build = templates[notification.type];
  if (!build) return null;

  const { subject, html } = build();
  return { to: recipient.email, subject, html };
}
