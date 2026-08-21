import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env, calendarConfigured } from "../lib/env";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

/** Short-lived signed state param — ties the OAuth callback back to the
 *  doctor who started the flow without trusting an unsigned query param. */
export function buildAuthUrl(doctorUserId: string): string {
  const client = getOAuthClient();
  const state = jwt.sign({ uid: doctorUserId }, env.JWT_SECRET, { expiresIn: "10m" });
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on repeat connects
    scope: SCOPES,
    state,
  });
}

export async function handleOAuthCallback(code: string, state: string) {
  const { uid } = jwt.verify(state, env.JWT_SECRET) as { uid: string };

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    // Happens if the doctor had already granted consent before and Google
    // didn't re-issue a refresh token — prompt:'consent' above is meant to
    // prevent this, but surface a clear error if it still happens.
    throw new Error(
      "Google didn't return a refresh token — revoke CareLoop's access at https://myaccount.google.com/permissions and try connecting again"
    );
  }

  await prisma.googleCalendarAuth.upsert({
    where: { userId: uid },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date!),
    },
    create: {
      userId: uid,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date!),
    },
  });

  return uid;
}

async function getAuthorizedClientForDoctor(doctorUserId: string) {
  const auth = await prisma.googleCalendarAuth.findUnique({ where: { userId: doctorUserId } });
  if (!auth) return null;

  const client = getOAuthClient();
  client.setCredentials({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.expiryDate.getTime(),
  });

  // google-auth-library refreshes the access token automatically when it's
  // expired; persist the refreshed one so we're not re-refreshing on every
  // single call.
  client.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    await prisma.googleCalendarAuth
      .update({
        where: { userId: doctorUserId },
        data: {
          accessToken: tokens.access_token,
          expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        },
      })
      .catch((err) => console.error("[calendar] failed to persist refreshed token", err));
  });

  return client;
}

export async function isDoctorCalendarConnected(doctorUserId: string): Promise<boolean> {
  const auth = await prisma.googleCalendarAuth.findUnique({ where: { userId: doctorUserId } });
  return Boolean(auth);
}

/**
 * Create/update/delete are all "best effort, never throw to the caller" —
 * a Calendar API outage must not break booking/cancellation, matching the
 * same graceful-degradation approach used for the LLM layer. Every outcome
 * (including "doctor hasn't connected calendar yet") is written to
 * CalendarEvent so it's visible to admin instead of silently vanishing.
 */
export async function syncCalendarEvent(params: {
  appointmentId: string;
  action: "create" | "update" | "delete";
}) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: params.appointmentId },
    include: { patient: true, doctor: true },
  });
  if (!appointment) return;

  const upsertRecord = (data: {
    status: string;
    googleEventId?: string | null;
    lastError?: string | null;
  }) =>
    prisma.calendarEvent.upsert({
      where: { appointmentId_userId: { appointmentId: appointment.id, userId: appointment.doctorId } },
      update: { ...data, lastSyncedAt: new Date() },
      create: {
        appointmentId: appointment.id,
        userId: appointment.doctorId,
        googleEventId: data.googleEventId ?? null,
        status: data.status,
        lastError: data.lastError ?? null,
        lastSyncedAt: new Date(),
      },
    });

  if (!calendarConfigured) {
    await upsertRecord({ status: "skipped_not_configured" });
    return;
  }

  const client = await getAuthorizedClientForDoctor(appointment.doctorId);
  if (!client) {
    await upsertRecord({ status: "skipped_doctor_not_connected" });
    return;
  }

  const calendar = google.calendar({ version: "v3", auth: client });
  const existing = await prisma.calendarEvent.findUnique({
    where: { appointmentId_userId: { appointmentId: appointment.id, userId: appointment.doctorId } },
  });

  try {
    if (params.action === "delete") {
      if (existing?.googleEventId) {
        await calendar.events.delete({ calendarId: "primary", eventId: existing.googleEventId });
      }
      await upsertRecord({ status: "deleted", googleEventId: null });
      return;
    }

    const eventBody = {
      summary: `Appointment: ${appointment.patient.name}`,
      description: "Booked via CareLoop.",
      start: { dateTime: appointment.startTime.toISOString() },
      end: { dateTime: appointment.endTime.toISOString() },
      attendees: [{ email: appointment.patient.email }],
    };

    if (params.action === "create" || !existing?.googleEventId) {
      const created = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventBody,
        sendUpdates: "all", // this is what actually emails the patient a calendar invite
      });
      await upsertRecord({ status: "synced", googleEventId: created.data.id });
    } else {
      await calendar.events.update({
        calendarId: "primary",
        eventId: existing.googleEventId,
        requestBody: eventBody,
        sendUpdates: "all",
      });
      await upsertRecord({ status: "synced", googleEventId: existing.googleEventId });
    }
  } catch (err: any) {
    console.error(`[calendar] sync failed for appointment ${appointment.id}`, err.message);
    await upsertRecord({
      status: "error",
      googleEventId: existing?.googleEventId ?? null,
      lastError: err.message?.slice(0, 500),
    });
  }
}
