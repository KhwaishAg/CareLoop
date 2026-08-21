import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { buildAuthUrl, handleOAuthCallback, isDoctorCalendarConnected } from "../services/calendar.service";
import { calendarConfigured, env } from "../lib/env";

export async function connect(req: AuthedRequest, res: Response) {
  if (!calendarConfigured) {
    return res.status(503).json({ error: "Google Calendar isn't configured on this server yet" });
  }
  const url = buildAuthUrl(req.user!.id);
  return res.json({ url });
}

export async function callback(req: AuthedRequest, res: Response) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${env.FRONTEND_URL}/doctor/settings?calendar=denied`);
  }
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing code or state");
  }

  try {
    await handleOAuthCallback(code, state);
    return res.redirect(`${env.FRONTEND_URL}/doctor/settings?calendar=connected`);
  } catch (err: any) {
    console.error("[calendar] oauth callback failed", err);
    return res.redirect(`${env.FRONTEND_URL}/doctor/settings?calendar=error`);
  }
}

export async function status(req: AuthedRequest, res: Response) {
  const connected = await isDoctorCalendarConnected(req.user!.id);
  return res.json({ connected });
}
