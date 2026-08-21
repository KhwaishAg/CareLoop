/**
 * STUB — real implementation lands in the notifications build phase
 * (task 8), which wires this to notificationQueue + a Nodemailer worker
 * with idempotency-keyed retries (see docs/design-writeup.md). Call sites
 * throughout the appointment engine and leave-conflict handling are
 * already wired to these functions so nothing needs restructuring later.
 */
export async function enqueueBookingConfirmation(_appointmentId: string): Promise<void> {
  // no-op until task 8
}

export async function enqueueCancellationNotice(
  _appointmentId: string,
  _reason: string
): Promise<void> {
  // no-op until task 8
}

export async function enqueueLeaveNotice(_appointmentId: string): Promise<void> {
  // no-op until task 8
}
