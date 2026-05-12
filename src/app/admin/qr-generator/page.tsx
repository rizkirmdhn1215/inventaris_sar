import { db } from "@/lib/db";
import { QrGeneratorClient } from "./qr-client";

export default async function QrGeneratorPage() {
  const categories = await db.itemCategory.findMany({ orderBy: { name: "asc" } });
  return (
    <QrGeneratorClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
