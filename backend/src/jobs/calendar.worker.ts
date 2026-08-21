import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { syncCalendarEvent } from "../services/calendar.service";

export const calendarWorker = new Worker(
  "calendar-sync",
  async (job) => {
    const { appointmentId, action } = job.data as {
      appointmentId: string;
      action: "create" | "update" | "delete";
    };
    // syncCalendarEvent never throws — every outcome (including "doctor
    // hasn't connected calendar", "API error") is written to CalendarEvent
    // instead, so this job always "succeeds" from BullMQ's point of view.
    // Retry/backoff (if we ever want it) belongs on the queue.add() call
    // that enqueues the job, not here on the worker.
    await syncCalendarEvent({ appointmentId, action });
  },
  { connection: redisConnection }
);

calendarWorker.on("failed", (job, err) => {
  console.error(`[calendar-sync] job ${job?.id} failed`, err);
});
