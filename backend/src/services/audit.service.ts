import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * One write per state-changing action, kept separate from the operational
 * tables on purpose — see docs/design-writeup.md. Never throws: a failed
 * audit write should never take down the request that triggered it.
 */
export async function recordAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        // Record<string, unknown> isn't directly assignable to Prisma's
        // InputJsonValue (a stricter recursive JSON type) — the cast is
        // safe here since metadata is always a plain JSON-serializable
        // object at every call site.
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record audit log", params.action, err);
  }
}
