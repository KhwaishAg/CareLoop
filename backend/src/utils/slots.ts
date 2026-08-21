import type { WorkingHours } from "../services/doctor.service";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Every appointment must start on a boundary this function would generate
 *  for its day — that invariant (documented in the blueprint) is what makes
 *  the partial unique index sufficient for double-booking prevention
 *  without also needing overlap detection on arbitrary intervals. */
export function generateSlotBoundaries(
  workingHours: WorkingHours,
  slotDurationMin: number,
  date: string // "YYYY-MM-DD"
): Date[] {
  const dayKey = DAY_KEYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  const hours = workingHours[dayKey];
  if (!hours || hours.length !== 2) return [];

  const [startStr, endStr] = hours;
  const slots: Date[] = [];

  let cursor = new Date(`${date}T${startStr}:00.000Z`);
  const end = new Date(`${date}T${endStr}:00.000Z`);

  while (cursor.getTime() + slotDurationMin * 60_000 <= end.getTime()) {
    slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + slotDurationMin * 60_000);
  }

  return slots;
}

export function isOnGeneratedBoundary(
  workingHours: WorkingHours,
  slotDurationMin: number,
  candidate: Date
): boolean {
  const date = candidate.toISOString().slice(0, 10);
  const boundaries = generateSlotBoundaries(workingHours, slotDurationMin, date);
  return boundaries.some((b) => b.getTime() === candidate.getTime());
}
