import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { prisma } from "../lib/prisma";

/**
 * Scheduled as a delayed job the instant a slot is HELD (see
 * appointment.service.ts holdSlot) — not polled. jobId is set to the
 * appointmentId so confirming or cancelling the hold early can cleanly
 * remove the pending job instead of leaving it to fire uselessly later.
 */
export const holdExpiryWorker = new Worker(
  "hold-expiry",
  async (job) => {
    const { appointmentId } = job.data as { appointmentId: string };

    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt) return; // already deleted somehow — nothing to do
    if (appt.status !== "HELD") return; // confirmed or already cancelled — job is stale, ignore

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", cancelReason: "HOLD_EXPIRED" },
    });

    console.log(`[hold-expiry] released expired hold for appointment ${appointmentId}`);
  },
  { connection: redisConnection }
);

holdExpiryWorker.on("failed", (job, err) => {
  console.error(`[hold-expiry] job ${job?.id} failed`, err);
});
