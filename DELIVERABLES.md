# CareLoop — Deliverables

Healthcare Appointment & Follow-up Manager — assignment submission.

## Repository

- **GitHub**: https://github.com/KhwaishAg/CareLoop
- **Stack**: React + Vite + TypeScript + Tailwind (frontend) · Node + Express + TypeScript (backend) · PostgreSQL via Prisma (Neon) · BullMQ + Redis (Upstash) · Gemini (LLM) · Nodemailer (Gmail SMTP) · Google Calendar API

## How to run locally

```
# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Requires a `backend/.env` (see `backend/.env.example`) with a Postgres connection string, Redis URL, JWT secret, Gemini API key, Gmail SMTP credentials, and (optional) Google Calendar OAuth client credentials.

## Demo accounts

All seeded with password `Password123!`:

- **Admin**: `admin@clinic.demo`
- **Doctor**: `dr.sharma@clinic.demo` (8 doctors seeded across specialisations, all `dr.*@clinic.demo`)
- **Patient**: `patient@demo.com`

## Scope covered

**Patient portal** — register/login, search and filter doctors by specialisation, view live slot availability, book/hold/confirm an appointment, AI-assisted symptom entry (typed or voice, with an AI "help me phrase this" assist and clarifying questions), reschedule/cancel, join a waitlist when fully booked, view AI-generated pre-visit brief and post-visit summary, medication list with reminders, a computed Health Timeline across all visits, follow-up tracking, editable profile with password change.

**Doctor portal** — daily schedule with computed readiness/urgency status per patient, AI-generated pre-visit brief (urgency, new/resolved/ongoing symptom breakdown, safety-signal flagging), consultation workspace (clinical notes + prescription, medicines chosen from a seeded catalog), AI-generated post-visit patient summary, patient list and per-patient history (same Health Timeline component as the patient view), follow-up tracking, a calendar week view, a searchable prescription history, and Google Calendar sync from Settings.

**Admin portal** — doctor management (create doctors, set working hours/specialisation/slot length, grouped by specialisation with search), leave-day scheduling with an impact preview and automatic patient notification when leave conflicts with existing bookings, clinic-wide waitlist monitoring, notification delivery-health monitoring (every email is a DB row before it's sent, so failures are visible, not silent), and an Overview page that surfaces actual operational issues needing attention rather than static stats.

**LLM usage** (Gemini, via REST — no SDK dependency) — three distinct real calls, not decorative: (1) live symptom-phrasing assist during booking, (2) background job turning raw symptoms into a structured pre-visit brief for the doctor, (3) background job turning clinical notes into a plain-language post-visit summary for the patient. All AI output is labeled "AI-assisted" and ends with a doctor-review note — it prepares information, it doesn't replace clinical judgment.

**Notifications & background jobs** — BullMQ + Redis queues for email notifications (booking confirmation, reminders, leave-conflict notices, waitlist offers, follow-up reminders) and medication reminder scheduling, with full delivery-status tracking.

**Security** — bcrypt password hashing, JWT + role-based access control on every protected route, doctor accounts cannot self-register (admin-created only, closing an earlier privilege-escalation gap), audit log on sensitive admin actions.

## Known limitations

- Google Calendar sync requires the doctor to connect their own account via OAuth (test-user mode; no verification needed for this assignment's scope).
- A few pages (doctor-facing calendar is a simple week view, not a full scheduling UI; no dedicated mobile app, only a responsive web layout with a mobile bottom nav) are intentionally scoped down given the assignment's timeframe.
- This is a free-tier deployment (Neon/Upstash/Gmail SMTP) — not built for production load.
