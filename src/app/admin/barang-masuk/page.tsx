import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireAdminPageScope } from "@/lib/admin-page";
import { BarangMasukClient } from "./barang-masuk-client";
import { STAFF_ROSTER_SEED } from "@/../prisma/data/staff-roster";

type PageProps = {
  searchParams: Promise<{ lokasi?: string }>;
};

export default async function BarangMasukPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);

  const isKppPadang = scope.activeLocation.slug === "kpp-padang" || scope.activeLocation.type === "kpp";
  if (!isKppPadang) {
    redirect("/admin/dashboard?error=Akses%20Barang%20Masuk%20hanya%20tersedia%20untuk%20KPP%20Padang");
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
      },
      orderBy: { name: "asc" },
    }),
    db.itemTransaction.findMany({
      where: { locationId: scope.locationId, type: "in" },
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
  }));

  const logs = transactions.map((t) => ({
    id: t.id,
    displayId: t.transactionCode,
    date: t.createdAt.toISOString().slice(0, 10),
    noRef: t.referenceNo || "-",
    itemName: t.item?.name ?? "Barang",
    category: t.item?.category?.name ?? "-",
    qty: t.quantity,
    qrCodes: t.qrCodes,
    source: t.source || "Pengadaan Baru",
    notes: t.notes ?? "",
    recipient: t.recipient || "",
    sender: t.sender || "",
  }));

  const staffOptions = STAFF_ROSTER_SEED.map((s) => ({
    nip: s.nip,
    name: s.name,
    jabatan: s.jabatan,
  }));

  return (
    <BarangMasukClient
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
