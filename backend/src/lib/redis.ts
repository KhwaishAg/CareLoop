import IORedis from "ioredis";
import { env } from "./env";

// BullMQ requires this exact option — it manages retries itself and
// throws if the underlying ioredis client limits retries on its own.
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on("error", (err) => {
  console.error("[redis] connection error", err.message);
});
