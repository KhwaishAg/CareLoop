/**
 * STUB — real implementation lands in the AI-layer build phase (task 7).
 *
 * Kept here now so appointment.service.ts has a stable call site instead
 * of needing rework later: booking already enqueues this, it just doesn't
 * do anything yet. When implemented, this pushes a job onto `llmQueue`
 * (see jobs/queues.ts) that a worker picks up and, on completion, writes
 * the structured result to SymptomForm/VisitNote and flips status to
 * READY (or FAILED, without blocking the appointment either way).
 */
export async function enqueuePreVisitSummaryJob(_appointmentId: string): Promise<void> {
  // no-op until task 7
}

export async function enqueuePostVisitSummaryJob(_appointmentId: string): Promise<void> {
  // no-op until task 7
}
