import { db } from "@/lib/db";

export type BorrowCatalogItem = {
  itemId: string;
  name: string;
  merk: string | null;
  categoryName: string | null;
  availableCount: number;
};

export async function getBorrowCatalog(): Promise<BorrowCatalogItem[]> {
  const items = await db.item.findMany({
    include: {
      category: true,
      units: {
        where: { status: "available", condition: "good" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return items
    .filter((item) => item.units.length > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      merk: item.merk,
      categoryName: item.category?.name ?? null,
      availableCount: item.units.length,
    }));
}

export type ScanUnitOption = {
  id: string;
  qrCode: string;
  itemId: string;
  itemName: string;
};

export async function getScannableUnits(): Promise<ScanUnitOption[]> {
  const units = await db.itemUnit.findMany({
    where: { status: "available", condition: "good" },
    include: { item: true },
    orderBy: { qrCode: "asc" },
    take: 500,
  });

  return units.map((unit) => ({
    id: unit.id,
    qrCode: unit.qrCode,
    itemId: unit.itemId,
    itemName: unit.item.name,
  }));
}
