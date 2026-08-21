import type { Response } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth";
import { joinWaitlist } from "../services/waitlist.service";
import { prisma } from "../lib/prisma";

const joinSchema = z.object({
  doctorProfileId: z.string().min(1),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  preferredEndTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function join(req: AuthedRequest, res: Response) {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: parsed.data.doctorProfileId } });
  if (!doctorProfile) return res.status(404).json({ error: "Doctor not found" });

  const entry = await joinWaitlist({
    patientId: req.user!.id,
    doctorId: doctorProfile.userId,
    preferredDate: parsed.data.preferredDate,
    preferredStartTime: parsed.data.preferredStartTime,
    preferredEndTime: parsed.data.preferredEndTime,
  });

  return res.status(201).json({ entry });
}

export async function mine(req: AuthedRequest, res: Response) {
  const entries = await prisma.waitlist.findMany({
    where: { patientId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ entries });
}
