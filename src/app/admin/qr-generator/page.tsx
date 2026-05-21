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

  return (
    <QrGeneratorClient
      locationId={scope.locationId}
      locationName={scope.activeLocation.name}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
