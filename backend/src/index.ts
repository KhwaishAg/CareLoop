import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import authRoutes from "./routes/auth.routes";
import doctorRoutes from "./routes/doctor.routes";
import adminRoutes from "./routes/admin.routes";
import appointmentRoutes from "./routes/appointment.routes";
import calendarRoutes from "./routes/calendar.routes";
import waitlistRoutes from "./routes/waitlist.routes";
import medicineRoutes from "./routes/medicine.routes";

// Render's free tier only covers Web Services — a separate Background
// Worker service (what `npm run worker` / worker.ts is meant for) is a
// paid-only service type there, so in production the API process also
// starts the BullMQ job listeners itself rather than requiring a second
// paid service. Locally, keep them split (`npm run dev` + `npm run
// worker` in two terminals) so a stuck AI/email call can't be confused
// with an API bug — set RUN_WORKER_INLINE=false to opt out even in prod.
if (env.NODE_ENV === "production" && process.env.RUN_WORKER_INLINE !== "false") {
  import("./worker.js");
}

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Hit by the free cron-job.org pinger every 10–14 min so Render's free
// tier never fully idles out — see README "Deployment" section.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/medicines", medicineRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});
