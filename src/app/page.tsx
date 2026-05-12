import { db } from "@/lib/db";
import { LandingClient } from "./landing-client";

type HomeProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    mode?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const units = await db.itemUnit.findMany({
    where: { status: "available" },
    include: {
      item: { include: { category: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const initialMode: "none" | "pinjam" | "kembali" =
    params.mode === "pinjam" || params.mode === "kembali" ? params.mode : "none";

  return (
    <LandingClient
      units={units.map((unit) => ({
        id: unit.id,
        qrCode: unit.qrCode,
        condition: unit.condition,
        itemName: unit.item.name,
        categoryName: unit.item.category?.name ?? null,
      }))}
      successRef={params.success}
      errorMessage={params.error}
      initialMode={initialMode}
    />
  );
}
