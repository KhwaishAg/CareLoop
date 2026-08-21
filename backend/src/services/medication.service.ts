import { prisma } from "../lib/prisma";
import { medicationQueue } from "../jobs/queues";
import type { FrequencyType } from "@prisma/client";

/**
 * Normalized reminder times per frequency — explicit and small rather than
 * a general-purpose scheduler, on purpose (see design-writeup.md
 * "medication reminders don't need to be pharmaceutical-grade").
 *
 * Note on timezone: times are treated the same way utils/slots.ts treats
 * working hours — "HH:MM" is interpreted directly in UTC for simplicity,
 * consistent with the rest of this project rather than adding per-patient
 * timezone handling, which is out of scope for this assignment.
 */
const REMINDER_TIME_MAP: Record<FrequencyType, string[]> = {
  ONCE_DAILY: ["09:00"],
  TWICE_DAILY: ["09:00", "21:00"],
  THRICE_DAILY: ["08:00", "14:00", "20:00"],
  EVERY_6_HOURS: ["06:00", "12:00", "18:00", "00:00"],
  EVERY_8_HOURS: ["08:00", "16:00", "00:00"],
  EVERY_12_HOURS: ["09:00", "21:00"],
  AS_NEEDED: [], // no scheduled reminders — patient takes it when needed
};

/** Next reminder occurrence on/after `fromDate`, never past `endDate`. */
function computeNextReminderAt(reminderTimes: string[], fromDate: Date, endDate: Date): Date | null {
  if (reminderTimes.length === 0) return null;

  const endOfDay = new Date(endDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Look up to 1 day past fromDate — enough to find the next slot even if
  // fromDate's remaining slots today have already passed.
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = new Date(fromDate);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const dateStr = day.toISOString().slice(0, 10);

    for (const time of [...reminderTimes].sort()) {
      const candidate = new Date(`${dateStr}T${time}:00.000Z`);
      if (candidate >= fromDate && candidate <= endOfDay) {
        return candidate;
      }
    }
  }
  return null;
}

export async function createMedication(params: {
  appointmentId: string;
  name: string;
  dosage: string;
  frequencyType: FrequencyType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  instructions?: string;
}) {
  const reminderTimes = REMINDER_TIME_MAP[params.frequencyType];
  const startDate = new Date(`${params.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${params.endDate}T00:00:00.000Z`);

  const firstReminder = computeNextReminderAt(
    reminderTimes,
    startDate > new Date() ? startDate : new Date(),
    endDate
  );

  const medication = await prisma.medication.create({
    data: {
      appointmentId: params.appointmentId,
      name: params.name,
      dosage: params.dosage,
      frequencyType: params.frequencyType,
      reminderTimes,
      startDate,
      endDate,
      instructions: params.instructions,
      nextReminderAt: firstReminder,
    },
  });

  if (firstReminder) {
    await scheduleReminderJob(medication.id, firstReminder);
  }

  return medication;
}

async function scheduleReminderJob(medicationId: string, at: Date) {
  const delayMs = Math.max(0, at.getTime() - Date.now());
  // jobId includes the scheduled time so a duplicate schedule call for the
  // same occurrence (e.g. a retried request) can't double-enqueue it.
  await medicationQueue.add(
    "reminder",
    { medicationId },
    { delay: delayMs, jobId: `${medicationId}:${at.toISOString()}` }
  );
}

/** Called by the worker after each reminder fires — computes and schedules
 *  the *next* occurrence rather than pre-generating the whole course
 *  upfront, so a 30-day prescription is one job in flight at a time, not 90. */
export async function scheduleNextReminder(medicationId: string): Promise<void> {
  const medication = await prisma.medication.findUnique({ where: { id: medicationId } });
  if (!medication) return;

  const reminderTimes = medication.reminderTimes as string[];
  const afterCurrent = new Date((medication.nextReminderAt?.getTime() ?? Date.now()) + 60_000);
  const next = computeNextReminderAt(reminderTimes, afterCurrent, medication.endDate);

  await prisma.medication.update({ where: { id: medicationId }, data: { nextReminderAt: next } });

  if (next) {
    await scheduleReminderJob(medicationId, next);
  }
}
