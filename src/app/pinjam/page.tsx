import { db } from "@/lib/db";
import { PinjamForm } from "./pinjam-form";

type PinjamPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function PinjamPage({ searchParams }: PinjamPageProps) {
  const params = await searchParams;
  const units = await db.itemUnit.findMany({
    where: { status: "available" },
    include: {
      item: {
        include: {
          category: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6">
      <PinjamForm
        units={units.map((unit) => ({
          id: unit.id,
          qrCode: unit.qrCode,
          condition: unit.condition,
          itemName: unit.item.name,
          categoryName: unit.item.category?.name ?? null,
        }))}
        successRef={params.success}
        errorMessage={params.error}
      />
    </div>
  );
}

