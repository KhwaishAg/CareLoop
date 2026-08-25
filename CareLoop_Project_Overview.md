# CareLoop — Project Overview

*A healthcare appointment & follow-up management platform, built for the assignment brief. This document explains what has been built, how it works, and what changed in the frontend redesign — written so you can walk someone else through the project.*

---

## 1. What CareLoop does

CareLoop is a full-stack web app with three portals — **Patient**, **Doctor**, and **Admin** — covering the full loop of a clinic visit:

1. A patient searches for a doctor and books an appointment.
2. Before the visit, the patient describes their symptoms in their own words (optionally with AI help phrasing it), and an AI-generated **pre-visit brief** is prepared for the doctor.
3. The doctor sees that brief, holds the consultation, and records clinical notes + a prescription.
4. An AI-generated **post-visit summary** is prepared for the patient in plain language.
5. The system tracks medications (with reminders), follow-up dates, a waitlist for fully-booked doctors, calendar sync, and email notifications for all of the above.
6. Admins manage doctors, working hours, leave days (with automatic patient notification if leave conflicts with existing bookings), and monitor the health of the notification/waitlist system.

Everything is built on free-tier services only, per the assignment constraint.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (hosted free-tier on Neon), accessed via Prisma ORM |
| Auth | JWT + bcrypt, role-based access control (Patient / Doctor / Admin) |
| AI | Google Gemini, called via raw REST (no SDK dependency) |
| Background jobs | BullMQ + Redis (hosted free-tier on Upstash) |
| Email | Nodemailer over Gmail SMTP |
| Calendar | Google Calendar API (OAuth 2.0) |

---

## 3. Data model (what's stored)

The database (via Prisma) has these core tables:

- **User** — every account (patient, doctor, or admin), with role, email, hashed password.
- **DoctorProfile** — specialisation, working hours (per day of week), consultation slot length. One per doctor `User`.
- **LeaveDay** — dates a doctor is unavailable, with a reason.
- **Appointment** — the booking itself: patient, doctor, start time, status (`BOOKED` / `HELD` / `COMPLETED` / `CANCELLED`), cancel reason, recommended follow-up date.
- **SymptomForm** — the patient's pre-visit input (raw symptoms, chief complaint, urgency, AI processing status) plus the AI-generated brief for the doctor.
- **VisitNote** — the doctor's clinical notes and the AI-generated patient-facing visit summary.
- **Medication** — prescribed medicines with dosage, frequency, and reminder scheduling.
- **MedicineCatalog** — a seeded reference list (~40 common medicines across specialisations) doctors pick from instead of typing from memory.
- **Waitlist** — patients waiting for a slot with a specific doctor when nothing is available.
- **Notification** — every email sent (or attempted), with type, channel, and delivery status — this is what Admin's "Notifications" monitoring page reads from.
- **CalendarEvent** / **GoogleCalendarAuth** — Google Calendar sync state per doctor.
- **AuditLog** — records sensitive admin actions (creating a doctor, marking leave, etc.) for accountability.

---

## 4. Where AI is actually used

The brief asked for genuine LLM usage, not decoration. CareLoop calls Gemini in three distinct places, each doing real work:

1. **Symptom phrasing assist** (patient-facing, live) — while typing symptoms during booking, a patient can tap "Help me phrase this" and Gemini rewrites their raw description more clearly and suggests up to 3 clarifying questions worth adding. This is a synchronous call (the patient is waiting on it), not a background job.
2. **Pre-visit brief** (doctor-facing, background job) — once a patient submits their symptoms, a BullMQ job asks Gemini to turn the raw symptom text into a structured clinical brief: chief complaint, urgency level (LOW/MEDIUM/HIGH), a "new vs. resolved vs. ongoing" symptom breakdown (compared against the patient's history with that doctor), and a safety-signal flag for anything that should be looked at urgently. This appears in the doctor's consultation view before/during the visit.
3. **Post-visit summary** (patient-facing, background job) — after the doctor completes the visit and enters clinical notes, another background job asks Gemini to translate those notes into a plain-language summary the patient can actually understand, which then appears in their visit history/timeline.

All AI output is explicitly labeled "AI-assisted" in the UI, and doctor-facing AI content ends with "AI-assisted · Doctor review required" — the AI never replaces clinical judgment, it prepares information for a human to review.

---

## 5. Background jobs & notifications

Two BullMQ queues run on Redis:

- **Notification queue** — sends emails for booking confirmations, appointment reminders, leave-conflict notices, waitlist offers, follow-up reminders, and failed-delivery tracking. Every send attempt is logged as a `Notification` row so Admin can see what succeeded/failed.
- **Medication queue** — schedules reminder jobs for each prescribed medication based on its frequency, so patients get reminded to take it.

*(One real bug fixed this session: BullMQ job IDs can't contain a colon (`:`) character, but our idempotency keys and ISO timestamps both used colons — this crashed the visit-completion flow. Fixed by deriving a colon-free job ID separately from the human-readable key used for database uniqueness, and a one-time repair script recovered the handful of reminders that had silently failed to schedule before the fix.)*

---

## 6. Google Calendar integration

Doctors connect their own Google Calendar via OAuth from Doctor → Settings. Once connected, every booked appointment is pushed to their calendar automatically with the patient added as an attendee (so the patient also gets Google's native reminders). A doctor can jump straight to `calendar.google.com` from the Settings page once connected.

---

## 7. Security notes worth mentioning

- Passwords are hashed with bcrypt, never stored plain.
- JWT-based auth with role checks (`requireRole(...)`) enforced on every protected route.
- **Doctor accounts cannot self-register.** Early on, registration let a user pick their own role — a privilege-escalation hole (anyone could register as "doctor"). This was closed: the public registration form only creates patient accounts. Doctor accounts are created exclusively by an admin (Admin → Doctors → Add doctor). The registration page still shows a "Patient / Doctor" toggle for clarity, but picking "Doctor" shows an explanation instead of a form.
- All admin actions that change clinical/staffing data (creating doctors, marking leave, etc.) are written to an `AuditLog`.

---

## 8. What's been redesigned on the frontend (for your explanation)

The original build was functionally complete but visually generic — a fairly standard "everything is a card in a grid" admin-dashboard look. A structural redesign is in progress (not just re-coloring), covering real information hierarchy changes:

### Design system
- New warm, muted palette (ivory background + sage-green accent, replacing a colder default blue/teal look) with **separate tokens for "brand color" vs. "success status"** — so a green success message and the brand accent don't visually collide.
- Dark mode is now an explicit toggle only (no longer auto-switches based on OS setting on first visit, which was surprising some users).

### Patient portal
- **Home page** restructured into a clear hierarchy: greeting → "Next appointment" hero panel (doctor, time, calendar-sync status) → a real **checklist** of next steps (symptom form done? medications active? follow-up due?) instead of generic stat tiles → a compact "Recent care" preview.
- **Health Timeline** (new, signature feature): a true chronological history of a patient's care — every visit, upcoming appointment, and recommended follow-up in one scrollable list, grouped by year, each past visit expandable to show the AI-written summary and what was prescribed. This is computed from real appointment data, not hard-coded.
- **Find a Doctor / booking**: added a search bar and specialisation filter (previously just a static list), and each doctor row now shows a **live "next available slot"** (e.g. "Next available Today · 3:30 PM") pulled from the real slot-availability endpoint — not a fake placeholder.
- Symptom entry now has the AI "help me phrase this" assist button live, with clarifying-question suggestions shown inline.

### Doctor portal
- **Today's schedule** rebuilt as a real appointment stream: each row now shows one clear status pill (Flagged / Awaiting symptoms / Preparing brief / urgency level / Brief ready) instead of multiple stacked badges, plus a computed "New patient" vs. "Follow-up" label per row.
- **Consultation workspace** rebuilt as a genuine two-column layout for active visits: the patient's AI pre-visit brief stays pinned on the left while the doctor fills in clinical notes and prescriptions on the right, instead of everything stacked in one long scroll.
- **Patient history page**: now uses the same Health Timeline component as the patient portal, so a doctor sees a patient's full visit history the same clear way.
- **Prescribing**: medicines are now chosen from the seeded medicine catalog via autocomplete, instead of the doctor typing from memory.

### Admin portal
- **Overview** rebuilt from a plain stat-card grid into an "attention" view — it surfaces actual operational issues that need action (overdue follow-ups, failed email deliveries, patients stuck on a waitlist) with a genuine "everything looks good" empty state when there's nothing to flag, rather than always showing the same four numbers.
- **Doctors page**: doctors are now grouped by specialisation with counts, each row shows a working-hours summary (e.g. "Mon–Fri · 9 AM–5 PM") instead of just a slot length, and there's a search box for finding a doctor quickly once the list grows.

### Landing page
- New hero copy and a visual "journey strip" (Symptoms → Appointment → Consultation → Treatment → Follow-up → Next visit) that previews the product's actual flow, plus a section explicitly framing how AI is used (assistive, not autonomous) and how patient data is kept safe.

### Still in progress
The redesign is being done page-by-page rather than all at once, to avoid breaking things. Not yet redesigned: Admin's Leave management, Waitlist, and Notifications monitoring pages; a dedicated Doctor calendar/profile page; a dedicated Patient profile page and doctor-profile detail view; and mobile-specific layout work. These are next in the queue.

---

## 9. How to demo it

- **Patient**: register a new account, search/filter for a doctor, book a slot, fill in symptoms (try the AI phrasing-assist button), and after a doctor completes the visit, check the Health Timeline for the AI-written visit summary.
- **Doctor**: log in with an admin-created doctor account, open a booked appointment to see the AI pre-visit brief, complete the visit with notes + a prescription (picked from the medicine catalog), and check Settings to connect Google Calendar.
- **Admin**: log in with the admin account, add a doctor, mark a leave day on a date with existing bookings (this triggers patient notification emails), and check the Overview page for anything needing attention.

*(Login credentials for the doctor/admin demo accounts — ask if you don't have them handy, they're in the seed data / earlier chat.)*
