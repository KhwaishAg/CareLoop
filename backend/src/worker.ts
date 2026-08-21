/**
 * Entry point for the background worker process — deployed and run
 * separately from the API (e.g. `npm run worker` as its own Render
 * process, or a second `node dist/worker.js` alongside the API). This is
 * exactly the kind of persistent process Vercel's serverless functions
 * can't provide, which is why the backend lives on Render instead.
 */
import "./lib/env";
import "./jobs/hold-expiry.worker";
import "./jobs/calendar.worker";
import "./jobs/llm.worker";
import "./jobs/email.worker";
// TODO: import "./jobs/medication.worker"   (task 9 — medication reminders)

console.log("Workers started: hold-expiry, calendar-sync, llm-jobs, notifications");
