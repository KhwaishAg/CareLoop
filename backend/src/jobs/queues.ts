import { Queue } from "bullmq";
import { redisConnection } from "../lib/redis";

// One queue per concern. Workers that consume them live in this same
// jobs/ folder and are started by src/worker.ts as a separate process
// from the API — see docs/design-writeup.md "why a separate worker process".

export const holdExpiryQueue = new Queue("hold-expiry", { connection: redisConnection });
export const llmQueue = new Queue("llm-jobs", { connection: redisConnection });
export const notificationQueue = new Queue("notifications", { connection: redisConnection });
export const medicationQueue = new Queue("medication-reminders", { connection: redisConnection });
export const calendarQueue = new Queue("calendar-sync", { connection: redisConnection });

const defaultBackoff = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 60_000 }, // 1m, 2m, 4m
};

export const jobDefaults = defaultBackoff;
