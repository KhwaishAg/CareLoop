/**
 * Entry point for the background worker process — deployed and run
 * separately from the API (e.g. `npm run worker` as its own Render
 * process, or a second `node dist/worker.js` alongside the API). This is
 * exactly the kind of persistent process Vercel's serverless functions
 * can't provide, which is why the backend lives on Render instead.
 */
import "./lib/env";
import "./jobs/hold-expiry.worker";
// TODO: import "./jobs/llm.worker"          (task 7 — AI layer)
// TODO: import "./jobs/email.worker"        (task 8 — notifications)
// TODO: import "./jobs/medication.worker"   (task 9 — medication reminders)

console.log("Workers started: hold-expiry");
