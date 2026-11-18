import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type UnitStatus =
  | "available"
  | "borrowed"
  | "maintenance"
  | "damaged"
  | "lost"
  | "retired";

/** Units counted in master inventory (excludes retired; history preserved in DB). */
export const activeUnitWhere = { status: { not: "retired" as const } };

export function toItemCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 20);
}

function toQrFilename(qrCode: string) {
  return `${qrCode.replace(/[^A-Z0-9-]/gi, "_")}.png`;
}

function toLocationCode(slug: string) {
  return slug
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}

export async function getNextQrCodes(itemId: string, itemName: string, count: number) {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { location: { select: { slug: true } } },
  });
  const locCode = item?.location?.slug ? toLocationCode(item.location.slug) : "SAR";
  const itemCode = toItemCode(itemName);
  const prefix = `SAR-${locCode}-${itemCode}-`;

  const lastUnit = await db.itemUnit.findFirst({
    where: { qrCode: { startsWith: prefix } },
    orderBy: { qrCode: "desc" },
    select: { qrCode: true },
  });

  const lastNumber = lastUnit
    ? Number(lastUnit.qrCode.slice(prefix.length)) || 0
    : 0;

  return Array.from({ length: count }, (_, index) => {
    const runningNumber = String(lastNumber + index + 1).padStart(4, "0");
    return `${prefix}${runningNumber}`;
  });
}

/** Generate persistent BMS-YYYYMMDD-XXXX / BKL-YYYYMMDD-XXXX code safely inside a transaction. */
export async function getNextTransactionCode(
  type: "in" | "out",
  txDate: Date,
  client: Prisma.TransactionClient | typeof db = db
) {
  const ymd = txDate.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${type === "in" ? "BMS" : "BKL"}-${ymd}-`;

  // ponytail: advisory lock + 4-digit lexical sort holds up to 9,999 tx/day; switch to DB sequence if exceeded
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;

  const last = await client.itemTransaction.findFirst({
    where: { transactionCode: { startsWith: prefix } },
    orderBy: { transactionCode: "desc" },
    select: { transactionCode: true },
  });

  const lastNumber = last ? Number(last.transactionCode.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

/** Sync items.stok with the authoritative count of active (non-retired) item_units. */
export async function syncItemStok(
  itemId: string,
  client: Prisma.TransactionClient | typeof db = db
) {
  const activeCount = await client.itemUnit.count({
    where: { itemId, ...activeUnitWhere },
  });
  await client.item.update({
    where: { id: itemId },
    data: { stok: activeCount },
  });
  return activeCount;
}

/**
 * Set active unit count (retired units are excluded from total but kept for loan history).
 */
export async function adjustItemUnitCount(itemId: string, targetCount: number) {
  if (!Number.isInteger(targetCount) || targetCount < 0 || targetCount > 500) {
    throw new Error("Jumlah unit harus antara 0 dan 500.");
  }

  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { id: true, name: true },
  });
  if (!item) throw new Error("Barang tidak ditemukan.");

  const units = await db.itemUnit.findMany({
    where: { itemId, ...activeUnitWhere },
    select: { id: true, status: true, createdAt: true },
  });

  const current = units.length;
  if (targetCount === current) {
    await syncItemStok(item.id);
    return;
  }

  if (targetCount > current) {
    const toAdd = targetCount - current;
    const qrCodes = await getNextQrCodes(item.id, item.name, toAdd);
    await db.$transaction(async (tx) => {
      await tx.itemUnit.createMany({
        data: qrCodes.map((qrCode) => ({
          itemId: item.id,
          qrCode,
          status: "available",
        })),
      });
      await syncItemStok(item.id, tx);
    });
    return;
  }

  const needRemove = current - targetCount;
  const borrowedCount = units.filter((u) => u.status === "borrowed").length;
  const removableSlots = current - borrowedCount;

  if (needRemove > removableSlots) {
    throw new Error(
      `Tidak bisa mengurangi ${needRemove} unit. ${borrowedCount} unit masih dipinjam — ` +
        `kembalikan dulu, lalu kurangi jumlah unit.`
    );
  }

  const statusOrder: Record<string, number> = { available: 0, maintenance: 1 };
  const toRetire = units
    .filter((u) => u.status !== "borrowed")
    .sort((a, b) => {
      const oa = statusOrder[a.status] ?? 2;
      const ob = statusOrder[b.status] ?? 2;
      if (oa !== ob) return oa - ob;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, needRemove);

  await db.$transaction(async (tx) => {
    await tx.itemUnit.updateMany({
      where: { id: { in: toRetire.map((u) => u.id) } },
      data: { status: "retired" },
    });
    await syncItemStok(item.id, tx);
  });
}

/** Set how many units are in maintenance; adjusts available ↔ maintenance only. */
export async function adjustItemMaintenanceCount(itemId: string, targetMaintenance: number) {
  if (!Number.isInteger(targetMaintenance) || targetMaintenance < 0 || targetMaintenance > 500) {
    throw new Error("Jumlah maintenance harus antara 0 dan 500.");
  }

  const units = await db.itemUnit.findMany({
    where: { itemId, ...activeUnitWhere },
    select: { id: true, status: true },
  });

  const currentMaintenance = units.filter((u) => u.status === "maintenance").length;
  if (targetMaintenance === currentMaintenance) return;

  if (targetMaintenance > currentMaintenance) {
    const need = targetMaintenance - currentMaintenance;
    const available = units.filter((u) => u.status === "available");
    if (available.length < need) {
      throw new Error(
        `Hanya ${available.length} unit tersedia. Kurangi jumlah maintenance atau tambah unit terlebih dahulu.`
      );
    }
    await db.itemUnit.updateMany({
      where: { id: { in: available.slice(0, need).map((u) => u.id) } },
      data: { status: "maintenance" },
    });
    return;
  }

  const release = currentMaintenance - targetMaintenance;
  const inMaintenance = units.filter((u) => u.status === "maintenance");
  await db.itemUnit.updateMany({
    where: { id: { in: inMaintenance.slice(0, release).map((u) => u.id) } },
    data: { status: "available" },
  });
}

/** Pick N available, non-maintenance units for an item (FIFO by qr code). */
export async function allocateAvailableUnits(
  itemId: string,
  quantity: number,
  excludeIds: string[] = []
) {
  const units = await db.itemUnit.findMany({
    where: {
      itemId,
      status: "available",
      condition: "good",
      id: { notIn: excludeIds },
    },
    orderBy: { qrCode: "asc" },
    take: quantity,
    select: { id: true, condition: true },
  });

  if (units.length < quantity) {
    return null;
  }
  return units;
}

export type PdfLoanLine = {
  itemName: string;
  quantity: number;
  merk?: string | null;
  condition: string;
};

/** Group loan items by master item for compact PDF tables. */
export function groupLoanItemsForPdf(
  loanItems: {
    itemUnit: {
      item: { id: string; name: string; merk?: string | null };
    };
    conditionAtBorrow: string;
  }[]
): PdfLoanLine[] {
  const map = new Map<
    string,
    { itemName: string; merk: string | null; quantity: number; conditions: string[] }
  >();

  for (const li of loanItems) {
    const key = li.itemUnit.item.id;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.conditions.push(li.conditionAtBorrow);
    } else {
      map.set(key, {
        itemName: li.itemUnit.item.name,
        merk: li.itemUnit.item.merk ?? null,
        quantity: 1,
        conditions: [li.conditionAtBorrow],
      });
    }
  }

  return [...map.values()].map((row) => ({
    itemName: row.itemName,
    merk: row.merk,
    quantity: row.quantity,
    condition: row.conditions.every((c) => c === "good")
      ? "Baik"
      : row.conditions.join(", "),
  }));
}
