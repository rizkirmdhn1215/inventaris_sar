import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireAdminPageScope } from "@/lib/admin-page";
import { BarangKeluarClient } from "./barang-keluar-client";
import { STAFF_ROSTER_SEED } from "@/../prisma/data/staff-roster";

type PageProps = {
  searchParams: Promise<{ lokasi?: string }>;
};

export default async function BarangKeluarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);

  const isKppPadang = scope.activeLocation.slug === "kpp-padang" || scope.activeLocation.type === "kpp";
  if (!isKppPadang) {
    redirect("/admin/dashboard?error=Akses%20Barang%20Keluar%20hanya%20tersedia%20untuk%20KPP%20Padang");
  }

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

  const dailyTotalMap = new Map<string, number>();
  for (const t of transactions) {
    const dateKey = t.createdAt.toISOString().slice(0, 10);
    dailyTotalMap.set(dateKey, (dailyTotalMap.get(dateKey) ?? 0) + 1);
  }
  const dailySeenMap = new Map<string, number>();

  const logs = transactions.map((t) => {
    const dateStr = t.createdAt.toISOString().slice(0, 10);
    const seen = dailySeenMap.get(dateStr) ?? 0;
    const totalForDay = dailyTotalMap.get(dateStr) ?? 1;
    const seq = totalForDay - seen;
    dailySeenMap.set(dateStr, seen + 1);
    const ymd = dateStr.replace(/-/g, "");

    return {
      id: t.id,
      displayId: `BKL-${ymd}-${String(seq).padStart(4, "0")}`,
      date: dateStr,
      noRef: t.referenceNo || "-",
      itemName: t.item?.name ?? "Barang",
      category: t.item?.category?.name ?? "-",
      qty: t.quantity,
      qrCodes: t.qrCodes,
      reason: t.source || "Pengeluaran",
      recipient: t.recipient || "-",
      target: t.sender || "-",
      notes: t.notes ?? "",
    };
  });

  const staffOptions = STAFF_ROSTER_SEED.map((s) => ({
    nip: s.nip,
    name: s.name,
    jabatan: s.jabatan,
  }));

  return (
    <BarangKeluarClient
      locationId={scope.locationId}
      locationSlug={scope.activeLocation.slug}
      locationName={scope.activeLocation.name}
      items={itemOptions}
      categories={categories}
      staffRoster={staffOptions}
      initialLogs={logs}
    />
  );
}
