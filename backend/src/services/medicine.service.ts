import { prisma } from "../lib/prisma";

/** Full catalog, capped at a sane page size — the frontend fetches this
 *  once and filters client-side as the doctor types, rather than firing a
 *  network request per keystroke. */
export async function listMedicineCatalog(query?: string) {
  return prisma.medicineCatalog.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    take: 300,
  });
}
