import { db } from "@/lib/db";
import { QrGeneratorClient } from "./qr-client";
import { requireAdminPageScope } from "@/lib/admin-page";

type QrPageProps = {
  searchParams: Promise<{ lokasi?: string }>;
};

export default async function QrGeneratorPage({ searchParams }: QrPageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);

  const categories = await db.itemCategory.findMany({
    where: { locationId: scope.locationId },
    orderBy: { name: "asc" },
  });

  const items = await db.item.findMany({
    where: { locationId: scope.locationId },
    include: {
      category: { select: { name: true } },
      units: {
        where: { status: { not: "retired" } },
        orderBy: { qrCode: "asc" },
        select: { id: true, qrCode: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const catalog = items
    .filter((item) => item.units.length > 0)
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      categoryName: item.category?.name ?? null,
      units: item.units.map((u) => ({
        unitId: u.id,
        qrCode: u.qrCode,
        status: u.status,
      })),
    }));

  return (
    <QrGeneratorClient
      locationId={scope.locationId}
      locationName={scope.activeLocation.name}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      catalog={catalog}
    />
  );
}
