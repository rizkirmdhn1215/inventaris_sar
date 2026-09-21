/**
 * Import Master Barang dari file Excel backup
 * File: prisma/scripts/master-barang-20260819.xlsx
 * Usage: npx tsx prisma/scripts/import-master-barang.ts
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();
const KPP_PADANG_ID = "00000000-0000-4000-8000-000000000001";

function makeQrCode(itemIndex: number, unitIndex: number): string {
  return "KPP-" + String(itemIndex).padStart(3, "0") + "-U" + String(unitIndex).padStart(2, "0");
}

interface XlsxRow {
  no: number;
  name: string;
  category: string;
  merk: string;
  type: string;
  kodeGudang: string;
  description: string;
  totalUnit: number;
  tersedia: number;
  dipinjam: number;
  maintenance: number;
  rusakHilang: number;
}

function parseRow(row: unknown[]): XlsxRow | null {
  const no = row[0];
  const name = row[1];
  if (!no || !name) return null;
  const clean = (v: unknown) => (String(v ?? "").trim() === "-" ? "" : String(v ?? "").trim());
  return {
    no: Number(no),
    name: String(name).trim(),
    category: clean(row[2]),
    merk: clean(row[3]),
    type: clean(row[4]),
    kodeGudang: clean(row[5]),
    description: clean(row[6]),
    totalUnit: Number(row[7]) || 0,
    tersedia: Number(row[8]) || 0,
    dipinjam: Number(row[9]) || 0,
    maintenance: Number(row[10]) || 0,
    rusakHilang: Number(row[11]) || 0,
  };
}

async function main() {
  const xlsxPath = path.resolve(process.cwd(), "prisma/scripts/master-barang-20260819.xlsx");
  console.log("Reading: " + xlsxPath);
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  const rows: XlsxRow[] = rawData.slice(1).map(parseRow).filter((r): r is XlsxRow => r !== null);
  console.log("Parsed " + rows.length + " items from Excel\n");

  const uniqueCategories = [...new Set(rows.map((r) => r.category).filter(Boolean))];
  console.log("Upserting " + uniqueCategories.length + " categories...");
  const categoryMap = new Map<string, string>();
  for (const name of uniqueCategories) {
    const cat = await prisma.itemCategory.upsert({
      where: { locationId_name: { locationId: KPP_PADANG_ID, name } },
      update: {},
      create: { locationId: KPP_PADANG_ID, name },
    });
    categoryMap.set(name, cat.id);
    console.log("  v " + name);
  }

  console.log("\nImporting " + rows.length + " items...");
  let totalUnitsCreated = 0;
  let itemsUpserted = 0;

  for (const row of rows) {
    const categoryId = row.category ? (categoryMap.get(row.category) ?? null) : null;

    let item = await prisma.item.findFirst({
      where: { locationId: KPP_PADANG_ID, name: row.name },
    });

    if (item) {
      item = await prisma.item.update({
        where: { id: item.id },
        data: {
          categoryId,
          merk: row.merk || null,
          type: row.type || null,
          kodeGudang: row.kodeGudang || null,
          description: row.description || null,
        },
      });
    } else {
      item = await prisma.item.create({
        data: {
          locationId: KPP_PADANG_ID,
          categoryId,
          name: row.name,
          merk: row.merk || null,
          type: row.type || null,
          kodeGudang: row.kodeGudang || null,
          description: row.description || null,
        },
      });
    }
    itemsUpserted++;

    await prisma.itemUnit.deleteMany({ where: { itemId: item.id } });

    const unitBatches: Array<{ status: string; condition: string; count: number }> = [
      { status: "available", condition: "good", count: row.tersedia },
      { status: "borrowed", condition: "good", count: row.dipinjam },
      { status: "maintenance", condition: "good", count: row.maintenance },
      { status: "retired", condition: "damaged", count: row.rusakHilang },
    ];

    let unitSeq = 1;
    for (const batch of unitBatches) {
      for (let i = 0; i < batch.count; i++) {
        await prisma.itemUnit.create({
          data: {
            itemId: item.id,
            qrCode: makeQrCode(row.no, unitSeq),
            status: batch.status,
            condition: batch.condition,
          },
        });
        unitSeq++;
        totalUnitsCreated++;
      }
    }

    const counted = row.tersedia + row.dipinjam + row.maintenance + row.rusakHilang;
    const remainder = row.totalUnit - counted;
    for (let i = 0; i < remainder; i++) {
      await prisma.itemUnit.create({
        data: {
          itemId: item.id,
          qrCode: makeQrCode(row.no, unitSeq),
          status: "available",
          condition: "good",
        },
      });
      unitSeq++;
      totalUnitsCreated++;
    }

    console.log("  [" + String(row.no).padStart(3, " ") + "] " + row.name + " -> " + (unitSeq - 1) + " unit(s)");
  }

  console.log("\nImport complete!");
  console.log("  Items upserted : " + itemsUpserted);
  console.log("  Units created  : " + totalUnitsCreated);
  console.log("  Categories     : " + uniqueCategories.length);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error("Import failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
