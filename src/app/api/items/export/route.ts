import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const locationId = url.searchParams.get("locationId") ?? undefined;
  const q = url.searchParams.get("q")?.trim() ?? "";
  const merk = url.searchParams.get("merk")?.trim() ?? "";
  const categoryId = url.searchParams.get("category")?.trim() ?? "";

  const where = {
    ...(locationId ? { locationId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { kodeGudang: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(merk ? { merk: { contains: merk, mode: "insensitive" as const } } : {}),
    ...(categoryId ? { categoryId } : {}),
  };

  const items = await db.item.findMany({
    where,
    include: {
      category: true,
      units: {
        where: { status: { not: "retired" } },
        select: { id: true, status: true, condition: true, qrCode: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // ── Build worksheet rows ─────────────────────────────────────────────────

  type Row = {
    No: number;
    "Nama Barang": string;
    Kategori: string;
    Merk: string;
    Type: string;
    "Kode Gudang": string;
    Deskripsi: string;
    "Total Unit": number;
    Tersedia: number;
    Dipinjam: number;
    Maintenance: number;
    "Rusak / Hilang": number;
  };

  const rows: Row[] = items.map((item, i) => {
    const total = item.units.length;
    const available = item.units.filter((u) => u.status === "available").length;
    const borrowed = item.units.filter((u) => u.status === "borrowed").length;
    const maintenance = item.units.filter((u) => u.status === "maintenance").length;
    const damaged = item.units.filter(
      (u) => u.condition === "damaged" || u.condition === "lost"
    ).length;

    return {
      No: i + 1,
      "Nama Barang": item.name,
      Kategori: item.category?.name ?? "-",
      Merk: item.merk ?? "-",
      Type: item.type ?? "-",
      "Kode Gudang": item.kodeGudang ?? "-",
      Deskripsi: item.description ?? "-",
      "Total Unit": total,
      Tersedia: available,
      Dipinjam: borrowed,
      Maintenance: maintenance,
      "Rusak / Hilang": damaged,
    };
  });

  // ── Build workbook ───────────────────────────────────────────────────────

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 4 },   // No
    { wch: 30 },  // Nama Barang
    { wch: 16 },  // Kategori
    { wch: 14 },  // Merk
    { wch: 14 },  // Type
    { wch: 14 },  // Kode Gudang
    { wch: 30 },  // Deskripsi
    { wch: 10 },  // Total Unit
    { wch: 10 },  // Tersedia
    { wch: 10 },  // Dipinjam
    { wch: 12 },  // Maintenance
    { wch: 14 },  // Rusak / Hilang
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Master Barang");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `master-barang-${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
