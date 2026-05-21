import { db } from "@/lib/db";
import { getDefaultLocation } from "@/lib/location-scope";

/** Tim SAR roster is shared; canonical data lives at KPP Padang (seed). */
export async function getCanonicalBorrowerLocationId() {
  const loc = await getDefaultLocation();
  return loc.id;
}

/** Same autocomplete roster at every gudang/pos. */
export async function listInternalBorrowers(_locationId: string) {
  const canonicalId = await getCanonicalBorrowerLocationId();
  return db.internalBorrower.findMany({
    where: { locationId: canonicalId },
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

/** Copy KPP roster into a new pos so local DB stays in sync (optional for reporting). */
export async function copyInternalBorrowersToLocation(targetLocationId: string) {
  const sourceId = await getCanonicalBorrowerLocationId();
  if (sourceId === targetLocationId) return 0;

  const source = await db.internalBorrower.findMany({
    where: { locationId: sourceId },
  });

  let copied = 0;
  for (const b of source) {
    if (!b.nip) continue;
    await db.internalBorrower.upsert({
      where: {
        locationId_nip: { locationId: targetLocationId, nip: b.nip },
      },
      update: {
        name: b.name,
        pangkat: b.pangkat,
        jabatan: b.jabatan,
        appointedAt: b.appointedAt,
      },
      create: {
        locationId: targetLocationId,
        nip: b.nip,
        name: b.name,
        pangkat: b.pangkat,
        jabatan: b.jabatan,
        appointedAt: b.appointedAt,
      },
    });
    copied += 1;
  }
  return copied;
}

export async function rememberInternalBorrower(input: {
  locationId: string;
  borrowerId?: string | null;
  name: string;
  division: string;
}) {
  const canonicalLocationId = await getCanonicalBorrowerLocationId();
  const name = input.name.trim();
  const jabatan = input.division.trim();
  if (!name || !jabatan) return;

  const now = new Date();

  if (input.borrowerId) {
    const updated = await db.internalBorrower.updateMany({
      where: { id: input.borrowerId },
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
      locationId: canonicalLocationId,
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
    data: { locationId: canonicalLocationId, name, jabatan },
  });
}
