import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { transporter } from "../lib/mailer";
import { emailConfigured, env } from "../lib/env";
import { buildEmailContent } from "../services/notification.service";

export const emailWorker = new Worker(
  "notifications",
  async (job) => {
    const { notificationId } = job.data as { notificationId: string };

    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.status === "SENT") return; // already delivered — idempotent skip

    if (!emailConfigured || !transporter) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED", lastError: "Email not configured (SMTP_* env vars missing)" },
      });
      return; // a config problem — retrying won't help, so don't throw
    }

    const content = await buildEmailContent(notificationId);
    if (!content) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "FAILED", lastError: "Could not build email content — appointment or recipient missing" },
      });
      return;
    }

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    try {
      await transporter.sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to: content.to,
        subject: content.subject,
        html: content.html,
      });
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (err: any) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          attempts: { increment: 1 },
          lastError: err.message?.slice(0, 500) ?? "Unknown error",
          status: isFinalAttempt ? "FAILED" : undefined, // stays PENDING while retries remain
        },
      });
      throw err; // rethrow so BullMQ's own backoff/retry (and 'failed' logging) applies
    }
  },
  { connection: redisConnection }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[notifications] job ${job?.id} (${job?.name}) failed`, err.message);
});
