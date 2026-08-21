import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { transporter } from "../lib/mailer";
import { emailConfigured, env } from "../lib/env";
import { scheduleNextReminder } from "../services/medication.service";

export const medicationWorker = new Worker(
  "medication-reminders",
  async (job) => {
    const { medicationId } = job.data as { medicationId: string };

    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
      include: { appointment: { include: { patient: true } } },
    });

    if (medication && emailConfigured && transporter) {
      const patient = medication.appointment.patient;
      try {
        await transporter.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER,
          to: patient.email,
          subject: `Medication reminder: ${medication.name}`,
          html: `<p>Hi ${patient.name},</p><p>Time to take <strong>${medication.name} (${medication.dosage})</strong>.</p>${
            medication.instructions ? `<p>${medication.instructions}</p>` : ""
          }`,
        });
      } catch (err: any) {
        // A single missed reminder email isn't worth retrying with backoff
        // the way a booking confirmation is — the next occurrence is
        // already scheduled below regardless, so a transient failure here
        // just means one reminder was missed, not that the whole schedule
        // breaks.
        console.error(`[medication-reminders] send failed for ${medicationId}`, err.message);
      }
    }

    // Always chain the next occurrence, even if this send failed or the
    // medication record vanished mid-course wouldn't reach here anyway —
    // the schedule must not silently stop because one email bounced.
    await scheduleNextReminder(medicationId);
  },
  { connection: redisConnection }
);

medicationWorker.on("failed", (job, err) => {
  console.error(`[medication-reminders] job ${job?.id} failed`, err);
});
