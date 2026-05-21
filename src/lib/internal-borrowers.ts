import { db } from "@/lib/db";

export async function listInternalBorrowers(locationId: string) {
  return db.internalBorrower.findMany({
    where: { locationId },
    orderBy: [{ lastUsedAt: "desc" }, { usageCount: "desc" }, { name: "asc" }],
    select: {
      id: true,
      nip: true,
      name: true,
      pangkat: true,
      jabatan: true,
    },
  });
}

export function parseDdMmYyyy(value: string): Date | null {
  const parts = value.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => Number(p));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

export async function rememberInternalBorrower(input: {
  locationId: string;
  borrowerId?: string | null;
  name: string;
  division: string;
}) {
  const name = input.name.trim();
  const jabatan = input.division.trim();
  if (!name || !jabatan) return;

  const now = new Date();

  if (input.borrowerId) {
    const updated = await db.internalBorrower.updateMany({
      where: { id: input.borrowerId, locationId: input.locationId },
      data: {
        name,
        jabatan,
        usageCount: { increment: 1 },
        lastUsedAt: now,
      },
    });
    if (updated.count > 0) return;
  }

  const existing = await db.internalBorrower.findFirst({
    where: {
      locationId: input.locationId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    await db.internalBorrower.update({
      where: { id: existing.id },
      data: {
        jabatan,
        usageCount: { increment: 1 },
        lastUsedAt: now,
      },
    });
    return;
  }

  await db.internalBorrower.create({
    data: { locationId: input.locationId, name, jabatan },
  });
}
