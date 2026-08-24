/** Admin-only operational visibility: notification delivery health and the
 *  clinic-wide waitlist. Kept separate from the appointment/doctor
 *  controllers since these read from operational-support tables, not core
 *  booking state. */
import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export async function listNotifications(req: AuthedRequest, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const notifications = await prisma.notification.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      user: { select: { id: true, name: true, email: true } },
      appointment: { select: { id: true, startTime: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ notifications });
}

export async function listWaitlist(req: AuthedRequest, res: Response) {
  const entries = await prisma.waitlist.findMany({
    include: {
      patient: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return res.json({ entries });
}
