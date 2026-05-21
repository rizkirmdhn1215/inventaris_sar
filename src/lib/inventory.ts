import { db } from "@/lib/db";

export type UnitStatus = "available" | "borrowed" | "maintenance";

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

export async function getNextQrCodes(itemId: string, itemName: string, count: number) {
  const itemCode = toItemCode(itemName);
  const prefix = `SAR-${itemCode}-`;

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

/** Create or remove available units so total unit count matches target. */
export async function adjustItemUnitCount(itemId: string, targetCount: number) {
  if (!Number.isInteger(targetCount) || targetCount < 0 || targetCount > 500) {
    throw new Error("Jumlah unit harus antara 0 dan 500.");
  }

  const item = await db.item.findUnique({
    where: { id: itemId },
    include: { units: { select: { id: true, status: true } } },
  });
  if (!item) throw new Error("Barang tidak ditemukan.");

  const current = item.units.length;
  if (targetCount === current) return;

  if (targetCount > current) {
    const toAdd = targetCount - current;
    const qrCodes = await getNextQrCodes(item.id, item.name, toAdd);
    await db.itemUnit.createMany({
      data: qrCodes.map((qrCode) => ({
        itemId: item.id,
        qrCode,
        status: "available",
      })),
    });
    return;
  }

  const removable = item.units.filter((u) => u.status === "available");
  const needRemove = current - targetCount;
  if (removable.length < needRemove) {
    throw new Error(
      `Tidak bisa mengurangi ${needRemove} unit. Hanya ${removable.length} unit tersedia yang bisa dihapus (sisanya dipinjam atau maintenance).`
    );
  }

  const idsToDelete = removable.slice(0, needRemove).map((u) => u.id);
  await db.itemUnit.deleteMany({ where: { id: { in: idsToDelete } } });
}

/** Set how many units are in maintenance; adjusts available ↔ maintenance only. */
export async function adjustItemMaintenanceCount(itemId: string, targetMaintenance: number) {
  if (!Number.isInteger(targetMaintenance) || targetMaintenance < 0 || targetMaintenance > 500) {
    throw new Error("Jumlah maintenance harus antara 0 dan 500.");
  }

  const units = await db.itemUnit.findMany({
    where: { itemId },
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
