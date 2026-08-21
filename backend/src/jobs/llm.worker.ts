import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { processPreVisitSummary, processPostVisitSummary } from "../services/llm.service";

export const llmWorker = new Worker(
  "llm-jobs",
  async (job) => {
    const { appointmentId } = job.data as { appointmentId: string };

    if (job.name === "pre-visit") {
      await processPreVisitSummary(appointmentId);
    } else if (job.name === "post-visit") {
      await processPostVisitSummary(appointmentId);
    } else {
      console.warn(`[llm-jobs] unknown job name: ${job.name}`);
    }
  },
  { connection: redisConnection }
);

llmWorker.on("failed", (job, err) => {
  // Note: process*Summary() functions catch their own errors and write
  // FAILED status to the DB — a job landing here means something went wrong
  // outside that (e.g. the appointment record itself vanished), not a
  // normal LLM failure.
  console.error(`[llm-jobs] job ${job?.id} (${job?.name}) failed`, err);
});
