# CareLoop

A healthcare appointment and follow-up manager: separate patient, doctor, and admin portals, AI-assisted pre-visit and post-visit summaries, background notification jobs, and Google Calendar sync — built entirely on free-tier infrastructure.

Live demo: **[add your deployed URL here once live]**
Design reasoning (double-booking, leave conflicts, slot holds, notification failures): [`docs/design-writeup.md`](docs/design-writeup.md)

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind |
| Backend API | Node + Express + TypeScript |
| Background workers | Node + BullMQ, run as a separate process from the API |
| Database | PostgreSQL via Prisma ([Neon](https://neon.tech) free tier) |
| Queue / jobs | Redis via BullMQ ([Upstash](https://upstash.com) free tier) |
| LLM | Gemini, called via raw REST (no SDK dependency) |
| Email | Nodemailer over Gmail SMTP (App Password) |
| Calendar | Google Calendar API, OAuth 2.0 |

## Repository layout

```
backend/    Express API + Prisma schema + BullMQ workers
frontend/   React app (patient / doctor / admin portals)
docs/       design-writeup.md
```

## Architecture

```
┌──────────────┐        HTTPS/JSON        ┌──────────────────┐
│   Frontend   │ ───────────────────────▶ │   API (Express)   │
│ React + Vite │ ◀─────────────────────── │  backend/src/     │
└──────────────┘                          │  index.ts          │
                                           └─────────┬─────────┘
                                                      │ writes durable
                                                      │ state, enqueues
                                                      ▼ jobs
                    ┌──────────────┐        ┌──────────────────┐
                    │   Postgres    │◀──────▶│  Redis / BullMQ   │
                    │  (Prisma ORM) │        │      queues       │
                    └──────────────┘        └─────────┬─────────┘
                                                        │ processed by
                                                        ▼
                                           ┌──────────────────┐
                                           │ Worker (worker.ts) │
                                           │ hold-expiry ·      │
                                           │ llm · email ·      │
                                           │ calendar ·         │
                                           │ medication         │
                                           └─────────┬─────────┘
                                                      │ calls out to
                                          ┌───────────┼───────────┐
                                          ▼           ▼           ▼
                                     Gemini API   Gmail SMTP  Google Calendar
```

The API and worker are two independent Node processes sharing one Postgres database and one Redis instance. The API only ever does fast, synchronous work — reads, writes, and enqueuing jobs; the worker is where every slow or unreliable call (LLM, email, calendar) actually happens, so a Gemini timeout or an SMTP hiccup can never turn into a hung HTTP request. See `docs/design-writeup.md` for why that split matters for correctness, not just responsiveness.

## End-to-end workflow

What actually happens across one full appointment, from a patient picking a slot to the loop closing on follow-up:

```
PATIENT                          SYSTEM                                DOCTOR
───────                          ──────                                ──────
Browses doctors,
picks a slot         ──▶  POST /appointments/hold
                           Appointment row: status=HELD
                           holdExpiresAt = now + 5m
                           holdExpiryQueue job scheduled  ──┐
                                                              │ (fires only if
Types symptoms,                                              │  never confirmed —
optional "help me     ──▶  POST /appointments/symptom-assist │  see design write-up
phrase this" tap            Gemini: reorganizes patient's    │  §2 Slot hold)
                             own words, no invented detail    │
                                                              │
Confirms booking      ──▶  POST /appointments/:id/confirm    │
                           status: HELD → BOOKED  ◀───────────┘ (job becomes a no-op)
                           unique index now protects the slot
                           enqueue: booking-confirmation email
                           enqueue: pre-visit summary job
                           enqueue: calendar sync (if doctor connected)
                                    │
                                    ▼
                           WORKER picks up pre-visit job
                           Gemini: urgency + suggested questions +         ──▶  Opens the
                           change-from-last-visit vs. prior COMPLETED           patient's brief
                           visits with this doctor                             before the visit
                                    │
                    (day of)  Doctor completes the visit
                                                              ◀──────────  Enters clinical
                           status: BOOKED → COMPLETED                     notes + prescription
                           enqueue: post-visit summary job
                           medication reminders scheduled
                                    │
                                    ▼
                           WORKER: Gemini turns clinical notes
Views AI summary +    ◀──▶ into a patient-friendly summary,
medication schedule        in the patient's preferred language
                                    │
                    (later)   Medication reminder fires   ──▶  Notification row,
                                                                 emailed via worker
                    (if overdue)  Follow-up rollup surfaces it       ──▶  Doctor's
                                  on the doctor's dashboard                Home / Follow-ups

If the doctor takes leave before the visit: applyLeaveConflicts() cancels the BOOKED
appointment, notifies the patient, removes the calendar event, and offers the freed
slot to anyone on that doctor's waitlist — see design write-up §3.
```

Every arrow into "SYSTEM" either writes a durable row first or serializes on a database constraint before anything else happens — the API never assumes a background job will run in time; it only ever treats a job as cleanup for state that's already correct.

## Setup

### 1. Prerequisites

- Node 18+
- A free [Neon](https://neon.tech) Postgres database
- A free [Upstash](https://upstash.com) Redis database
- A free [Google AI Studio](https://aistudio.google.com) Gemini API key
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) generated
- A Google Cloud project with OAuth credentials (see **Google Calendar setup** below) — optional, the app runs without it, just without calendar sync

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in the values described below
npx prisma migrate dev
npm run seed            # creates demo accounts, see below
npm run dev              # API on :4000
```

In a second terminal, start the background worker process (required for notifications, slot-hold expiry, medication reminders, calendar sync, and AI jobs — the API alone won't process any of these locally):

```bash
cd backend
npm run worker
```

In production this runs differently — see **Deployment** below.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL — defaults to http://localhost:4000, fine for local dev
npm run dev              # http://localhost:5173
```

### 4. Demo accounts

Seeded by `npm run seed`, all with password `Password123!`:

| Role | Email |
|---|---|
| Admin | `admin@clinic.demo` |
| Doctor | `dr.sharma@clinic.demo` (8 doctors seeded across specialisations, all `dr.*@clinic.demo`) |
| Patient | `patient@demo.com` |

Doctor accounts can't self-register through the public form — they're admin-created only (Admin → Doctors → Add doctor), which closes an otherwise-real privilege-escalation gap.

## Environment variables (`backend/.env.example`)

```env
# ── Database (Neon free tier — https://neon.tech) ──────────────────────
DATABASE_URL="postgresql://user:password@ep-example.neon.tech/healthcare?sslmode=require"

# ── Auth ─────────────────────────────────────────────────────────────
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"

# ── Redis / BullMQ (Upstash free tier — https://upstash.com) ───────────
REDIS_URL="rediss://default:password@example.upstash.io:6379"

# ── LLM (Google AI Studio free tier — https://aistudio.google.com) ─────
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

# ── Email (Gmail SMTP — use an App Password, not your login password) ──
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="your-clinic-account@gmail.com"
SMTP_PASS="your-16-character-app-password"
SMTP_FROM="Healthcare Clinic <your-clinic-account@gmail.com>"

# ── Google Calendar OAuth 2.0 ───────────────────────────────────────────
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/calendar/oauth/callback"

# ── App ──────────────────────────────────────────────────────────────
PORT="4000"
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
SLOT_HOLD_MINUTES="5"
```

If `GEMINI_API_KEY`, SMTP, or Google OAuth vars are left unset, the app runs and degrades gracefully: AI jobs fail cleanly instead of throwing, notifications are marked `FAILED` with a clear reason instead of crashing the worker, and doctors simply won't see a "Connect Google Calendar" option resolve successfully. Nothing about local setup requires all of them on day one.

## Google Calendar setup

1. In the [Google Cloud Console](https://console.cloud.google.com), create a project (or reuse one) and enable the **Google Calendar API**.
2. Configure the OAuth consent screen as **External**, add your own Google account as a **test user** (test-user mode needs no Google verification — fine for this assignment's scope), and add the `https://www.googleapis.com/auth/calendar.events` scope.
3. Create an **OAuth 2.0 Client ID** (type: Web application). Add an authorized redirect URI matching `GOOGLE_REDIRECT_URI` exactly, e.g. `http://localhost:4000/api/calendar/oauth/callback` locally, or `https://your-api-domain/api/calendar/oauth/callback` in production.
4. Copy the generated Client ID and Client Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.
5. In the app, sign in as a doctor → Settings → Connect Google Calendar. This starts the OAuth flow (`GET /api/calendar/oauth/connect`); on consent, Google redirects to `GOOGLE_REDIRECT_URI`, which is handled by `GET /api/calendar/oauth/callback` and stores a refresh token against that doctor.

Design choice: calendar events are created on the **doctor's** calendar with the patient added as an attendee, so only doctors ever need to OAuth — a patient can book without connecting anything, and just receives a normal calendar-invite email.

## Database schema

Defined in `backend/prisma/schema.prisma`. Summary of the core models:

- **User** — one row per person, `role` is `PATIENT | DOCTOR | ADMIN`. Doctors get a linked `DoctorProfile` (specialisation, JSON `workingHours`, slot length). All appointment, notification, waitlist, calendar, and audit rows key off this table.
- **DoctorProfile** / **LeaveDay** — a doctor's schedule and any leave days (`@@unique([doctorId, date])`) blocking slots on those dates.
- **Appointment** — the booking lifecycle. `status` is `HELD | BOOKED | COMPLETED | CANCELLED`; a **partial unique index on `(doctorId, startTime)` where `status IN (HELD, BOOKED)`** is what actually prevents double-booking at the database level (see design write-up). A reschedule doesn't mutate a row — the original is cancelled (`cancelReason: RESCHEDULED`) and links to its replacement via `rescheduledFromId`/`rescheduledTo`, so history is never overwritten.
- **SymptomForm** / **VisitNote** — the two AI-touched records: raw patient symptoms in, structured pre-visit brief out (urgency, suggested questions, change-from-last-visit); clinical notes in, patient-friendly summary out.
- **Medication** — prescribed items with computed `reminderTimes` and `nextReminderAt`, driving the medication-reminder worker.
- **Waitlist** — a patient's standing request for a doctor/date/time-window when nothing was available; offered automatically when a matching slot frees up (cancellation or leave-conflict).
- **Notification** — one row per intended email, written **before** the send is attempted, with a unique `idempotencyKey` so retries can never double-queue (see design write-up).
- **CalendarEvent** / **GoogleCalendarAuth** — sync state per appointment and a doctor's stored OAuth refresh token.
- **MedicineCatalog** — a starter list of medicine names/dosages so a doctor completing a visit picks from known entries rather than free-typing every prescription.
- **AuditLog** — append-only record of sensitive actions (leave applied, profile changed, password changed, etc.), independent of the operational tables.

## API reference

All routes are prefixed `/api`. Routes marked 🔒 require a valid `Authorization: Bearer <token>` (from `/api/auth/login`); role restrictions are noted where the route isn't open to any authenticated user.

**Auth** — `backend/src/routes/auth.routes.ts`
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Patient self-registration only |
| POST | `/auth/login` | Returns a JWT |
| GET | `/auth/me` 🔒 | Current user's profile |
| PUT | `/auth/me` 🔒 | Update name / phone / preferred language |
| POST | `/auth/change-password` 🔒 | Requires current password |

**Doctors** — `backend/src/routes/doctor.routes.ts`
| Method | Path | Notes |
|---|---|---|
| GET | `/doctors` 🔒 | List/search doctors |
| GET | `/doctors/me` 🔒 | DOCTOR — own profile |
| GET | `/doctors/:id` 🔒 | Public doctor profile + working hours |

**Appointments** — `backend/src/routes/appointment.routes.ts`
| Method | Path | Notes |
|---|---|---|
| GET | `/appointments/slots` | Available slots for a doctor/date |
| GET | `/appointments/mine` 🔒 | Current user's appointments |
| GET | `/appointments/follow-ups` 🔒 | DOCTOR/ADMIN — overdue follow-up rollup |
| GET | `/appointments/:id/follow-up` 🔒 | Follow-up status for one appointment |
| POST | `/appointments/symptom-assist` 🔒 | PATIENT — Gemini rewrite of typed symptoms |
| POST | `/appointments/hold` 🔒 | PATIENT — place a temporary slot hold |
| POST | `/appointments/:id/confirm` 🔒 | PATIENT — HELD → BOOKED |
| POST | `/appointments/:id/cancel` 🔒 | PATIENT/DOCTOR/ADMIN |
| POST | `/appointments/:id/reschedule` 🔒 | PATIENT |
| POST | `/appointments/:id/complete` 🔒 | DOCTOR — attach clinical notes + prescription |

**Admin** — `backend/src/routes/admin.routes.ts`
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/doctors` | Create a doctor account |
| PUT | `/admin/doctors/:id` | Update specialisation/hours |
| POST | `/admin/doctors/:id/leave/preview` | Dry-run: which bookings a leave day would cancel |
| POST | `/admin/doctors/:id/leave` | Apply a leave day (cancels conflicts, notifies, offers waitlist) |
| DELETE | `/admin/doctors/:id/leave/:leaveId` | Remove a leave day |
| GET | `/admin/notifications` | Delivery-status monitoring |
| GET | `/admin/waitlist` | Clinic-wide waitlist view |

**Calendar** — `backend/src/routes/calendar.routes.ts`
| Method | Path | Notes |
|---|---|---|
| GET | `/calendar/oauth/connect` 🔒 | DOCTOR — start Google OAuth |
| GET | `/calendar/oauth/callback` | Google redirect target |
| GET | `/calendar/status` 🔒 | DOCTOR — connection status |

**Waitlist** — `backend/src/routes/waitlist.routes.ts`
| Method | Path | Notes |
|---|---|---|
| POST | `/waitlist` | Join a doctor's waitlist for a date/window |
| GET | `/waitlist/mine` 🔒 | Current patient's waitlist entries |

**Medicines** — `backend/src/routes/medicine.routes.ts`
| Method | Path | Notes |
|---|---|---|
| GET | `/medicines` 🔒 | DOCTOR/ADMIN — catalog for prescription entry |

## LLM usage

Three distinct Gemini calls, each with a system instruction that constrains the model to organizing/summarizing given information — never diagnosing, inventing, or embellishing — and to respond with strict JSON only (parsed against a Zod schema on the way back in; a failure surfaces as a clean error, never silently-wrong data).

**1. Live symptom-phrasing assist** (`assistSymptomDescription`, called from the booking form) — helps a patient tidy up what they already typed.

> System: *"You help patients describe their symptoms more clearly before a doctor's visit. You only reorganize and clarify what the patient already wrote — you never invent symptoms, never add severity or duration the patient didn't mention, and never diagnose or suggest treatment. Respond with ONLY valid JSON matching the requested schema, no markdown formatting, no commentary."*

Returns `{ improved, clarifyingQuestions[] }`. Runs synchronously in the request path (not a background job) since it needs to feel like a form-fill assist.

**2. Pre-visit summary** (`processPreVisitSummary`, background job) — turns raw symptoms plus the patient's visit history with that doctor into a structured brief.

> System: *"You are assisting a doctor with pre-visit preparation. You organize and summarize patient-submitted information — you never diagnose, never recommend treatment, and never invent symptoms not present in the input or prior visit context. Respond with ONLY valid JSON matching the requested schema, no markdown formatting, no commentary."*

Returns `{ urgency, urgencyFactors[], chiefComplaint, suggestedQuestions[3], changeFromLastVisit }`, where `changeFromLastVisit` is `null` on a first visit and otherwise `{ newSymptoms[], resolvedSymptoms[], ongoingSymptoms[], summary }` computed against prior visit context assembled server-side.

**3. Post-visit summary** (`processPostVisitSummary`, background job) — turns the doctor's clinical notes into a patient-friendly summary, in the patient's preferred language.

> System: *"You convert clinical notes into a patient-friendly summary. You only summarize information present in the notes — you never add, remove, or modify medication details, and you never present this as medical advice beyond what the doctor wrote. Respond with ONLY valid JSON matching the requested schema, no markdown formatting, no commentary."*

Returns `{ summary, medicationSchedule, followUpSteps }`. Every AI output is labeled "AI-assisted · Doctor reviewed" in the UI — it prepares information, it never stands in for clinical judgment.

All three prompts are built server-side from data already in the database or from what the patient just typed — no other user-controlled free text (names, notes elsewhere in the app) is concatenated into a prompt unsanitized. Before a symptom description ever reaches Gemini, `detectSafetySignal()` runs a deterministic keyword check for emergency-pattern language (e.g. chest pain, suicidal ideation) independent of the LLM — this flag doesn't depend on the model noticing anything, it's a plain string match that sets `safetySignalFlagged`/`safetySignalReason` on the `SymptomForm` and surfaces before the AI summary does.

## Security

- Passwords hashed with bcrypt; never logged or returned by any endpoint, including `/auth/me`.
- JWT-based auth (`requireAuth`) plus per-route role checks (`requireRole(...)`) — a patient token can't hit an admin or doctor-only route regardless of what it names in the URL.
- Doctor accounts are admin-created only; public registration always creates a `PATIENT`, even if the request body claims otherwise (see Register page note above) — closes a self-declared-doctor impersonation path.
- Sensitive admin actions (leave applied, profile updates, password changes) are written to `AuditLog`, independent of the operational tables, so they survive even if the record they touched is later deleted.
- `GOOGLE_REDIRECT_URI` OAuth state is a short-lived signed JWT (10 min), so the callback can't be replayed against a different doctor account than the one who started the flow.

## Deployment

Locally, and conceptually, the API and worker are two separate long-running Node processes (`npm run start` / `npm run worker`) — that split is what `docs/design-writeup.md` describes and it's why either needs a host that supports persistent processes rather than serverless functions (a BullMQ worker has to stay alive between jobs, not spin up per-request).

In practice, on Render's **free tier specifically**, Background Workers are a paid-only service type (there's no free option for them at all — only Web Services and Static Sites are free). Deploying the worker as its own paid service would break the assignment's free-tier constraint, so in production the same process that serves the API also starts the BullMQ job listeners itself — see the `if (env.NODE_ENV === "production") import("./worker")` guard at the top of `src/index.ts`. This keeps the deployment entirely on the free tier at the cost of the API and worker sharing one process's CPU/memory instead of two; that trade-off is explicit and reversible (`RUN_WORKER_INLINE=false` opts back out) if you ever move off the free tier.

Deploy three services from this repo:

1. **API (Web Service, free)** — root directory `backend`, build `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`, start `npm run start`. This single service now also runs the worker internally.
2. **Frontend (Static Site, free)** — root directory `frontend`, build `npm install && npm run build`, publish directory `dist`, env var `VITE_API_URL` pointed at the API service's URL.
3. A free uptime pinger (e.g. [cron-job.org](https://cron-job.org)) hitting the API's `GET /health` every 10–14 minutes, so the free instance never idles out.

There's no separate Background Worker service to deploy — see above for why.

## Useful scripts

- `backend/npm run repair:reminders` — one-off repair for medication rows whose reminder job failed to enqueue due to a since-fixed BullMQ job-ID bug (colons aren't valid in a custom job ID). Safe to run more than once: it reuses the same `jobId` scheme as normal scheduling, so BullMQ no-ops on anything already correctly queued instead of duplicating it.
- `backend/npm run lint` / `frontend/npm run lint` — type-check (`tsc --noEmit`) and lint respectively.

## Known limitations

- Google Calendar sync requires each doctor to connect their own account via OAuth; the OAuth consent screen runs in test-user mode (no Google app verification needed for this assignment's scope).
- The doctor-facing calendar is a simple week view, not a full scheduling UI; there's no native mobile app, only a responsive web layout with a mobile bottom nav.
- This targets free-tier infrastructure (Neon / Upstash / Gmail SMTP) — not built for production load, and a crash between a successful email send and its DB write-back could in rare cases double-send a single notification (see design write-up).
- No automated test suite yet — correctness for the four mechanisms in the design write-up currently rests on the database constraints and code paths themselves (partial unique index, idempotency keys, job IDs) rather than on regression tests. Manual verification was done through the demo accounts and seeded data.
