/**
 * One-off repair for medications whose reminder job failed to enqueue
 * because of the BullMQ "Custom Id cannot contain :" bug (fixed in
 * medication.service.ts). Those Medication rows were created successfully
 * — only the BullMQ job scheduling step crashed — so nextReminderAt is
 * already correct in the DB, it just never got a queued job behind it.
 *
 * Safe to run more than once: it reuses the exact same jobId scheme as
 * medication.service.ts, so BullMQ silently no-ops on any reminder that's
 * already properly scheduled instead of creating a duplicate.
 *
 * Run with: npm run repair:reminders
 */
import { prisma } from "../src/lib/prisma";
import { medicationQueue } from "../src/jobs/queues";

async function main() {
  const medications = await prisma.medication.findMany({
    where: { nextReminderAt: { gte: new Date() } },
    include: { appointment: { include: { patient: true } } },
  });

  console.log(`Found ${medications.length} medication(s) with a future reminder due.`);

  let rescheduled = 0;
  for (const med of medications) {
    if (!med.nextReminderAt) continue;

    const idSafeTimestamp = med.nextReminderAt.toISOString().replace(/[^0-9]/g, "");
    const jobId = `${med.id}-${idSafeTimestamp}`;

    const existingJob = await medicationQueue.getJob(jobId);
    if (existingJob) continue; // already scheduled — nothing to repair here

    const delayMs = Math.max(0, med.nextReminderAt.getTime() - Date.now());
    await medicationQueue.add("reminder", { medicationId: med.id }, { delay: delayMs, jobId });

    console.log(
      ` rescheduled: ${med.name} for ${med.appointment.patient.name} at ${med.nextReminderAt.toISOString()}`
    );
    rescheduled++;
  }

  console.log(`Done — rescheduled ${rescheduled} reminder(s), ${medications.length - rescheduled} were already fine.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
