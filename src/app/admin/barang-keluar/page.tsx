import { db } from "@/lib/db";
import { requireAdminPageScope } from "@/lib/admin-page";
import { BarangKeluarClient } from "./barang-keluar-client";

type PageProps = {
  searchParams: Promise<{ lokasi?: string }>;
};

export default async function BarangKeluarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);

  const [categories, items, transactions] = await Promise.all([
    db.itemCategory.findMany({
      where: { locationId: scope.locationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.item.findMany({
      where: { locationId: scope.locationId },
      include: {
        category: { select: { name: true } },
        units: {
          where: { status: { not: "retired" } },
          orderBy: { qrCode: "asc" },
          select: { id: true, qrCode: true, status: true, condition: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.itemTransaction.findMany({
      where: { locationId: scope.locationId, type: "out" },
      include: {
        item: {
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const itemOptions = items.map((item) => ({
    id: item.id,
    name: item.name,
    categoryName: item.category?.name ?? null,
    merk: item.merk,
    units: item.units.map((u) => ({
      id: u.id,
      qrCode: u.qrCode,
      status: u.status,
      condition: u.condition,
    })),
  }));

  const logs = transactions.map((t) => ({
    id: t.id,
    displayId: t.id.slice(0, 8).toUpperCase(),
    date: t.createdAt.toISOString().slice(0, 10),
    noRef: t.referenceNo || "-",
    itemName: t.item?.name ?? "Barang",
    category: t.item?.category?.name ?? "-",
    qty: t.quantity,
    qrCodes: t.qrCodes,
    reason: t.source || "Pengeluaran",
    recipient: t.recipient || "-",
    target: t.sender || "-",
    notes: t.notes ?? "",
  }));

  return (
    <BarangKeluarClient
      locationId={scope.locationId}
      locationSlug={scope.activeLocation.slug}
      locationName={scope.activeLocation.name}
      items={itemOptions}
      categories={categories}
      initialLogs={logs}
    />
  );
}
