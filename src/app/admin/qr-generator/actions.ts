"use server";

import { db } from "@/lib/db";
import QRCode from "qrcode";
import { uploadBufferToMinio } from "@/lib/minio";

type QrResultItem = {
  itemName: string;
  qrCode: string;
  qrImagePath: string;
};

export type QrGeneratorState = {
  error?: string;
  success?: string;
  generated?: QrResultItem[];
};

function toItemCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 20);
}

function toQrFilename(qrCode: string) {
  return `${qrCode.replace(/[^A-Z0-9-]/gi, "_")}.png`;
}

export async function generateQrAction(
  _prevState: QrGeneratorState | null,
  formData: FormData
): Promise<QrGeneratorState> {
  const rawNames = formData
    .getAll("itemName")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const rawQuantities = formData
    .getAll("quantity")
    .map((v) => Number(String(v)));
  const rawCategoryIds = formData
    .getAll("categoryId")
    .map((v) => String(v).trim());
  const locationId = String(formData.get("locationId") ?? "").trim();

  if (!locationId) {
    return { error: "Lokasi tidak valid." };
  }

  if (rawNames.length === 0) {
    return { error: "Minimal isi 1 nama barang." };
  }

  if (rawNames.length !== rawQuantities.length) {
    return { error: "Data barang dan jumlah tidak sinkron." };
  }

  const entries = rawNames.map((itemName, index) => ({
    itemName,
    quantity: rawQuantities[index],
    categoryId: rawCategoryIds[index] || null,
  }));

  for (const entry of entries) {
    if (
      !Number.isInteger(entry.quantity) ||
      entry.quantity <= 0 ||
      entry.quantity > 200
    ) {
      return {
        error: `Jumlah unit untuk "${entry.itemName}" harus angka 1 sampai 200.`,
      };
    }
  }

  const generated: QrResultItem[] = [];
  const qrBucketName = process.env.MINIO_BUCKET_QRS || "item-qrs";

  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { slug: true },
  });
  if (!location) return { error: "Lokasi tidak ditemukan." };

  const locCode = location.slug
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);

  for (const { itemName, quantity, categoryId } of entries) {
    let item = await db.item.findFirst({
      where: { name: itemName, locationId },
    });
    if (!item) {
      item = await db.item.create({
        data: {
          locationId,
          name: itemName,
          categoryId: categoryId ?? null,
        },
      });
    } else if (categoryId && item.categoryId !== categoryId) {
      item = await db.item.update({
        where: { id: item.id },
        data: { categoryId },
      });
    }

    const itemCode = toItemCode(itemName);
    const prefix = `SAR-${locCode}-${itemCode}-`;

    const lastUnit = await db.itemUnit.findFirst({
      where: { qrCode: { startsWith: prefix } },
      orderBy: { qrCode: "desc" },
      select: { qrCode: true },
    });

    const lastNumber = lastUnit
      ? Number(lastUnit.qrCode.slice(prefix.length)) || 0
      : 0;

    const unitsToCreate = Array.from({ length: quantity }, (_, index) => {
      const runningNumber = String(lastNumber + index + 1).padStart(4, "0");
      const qrCode = `${prefix}${runningNumber}`;
      const qrFilename = toQrFilename(qrCode);
      return {
        itemId: item.id,
        qrCode,
        qrImagePath: `/qr-storage/${qrFilename}`,
        qrFilename,
      };
    });

    for (const unit of unitsToCreate) {
      try {
        const buffer = await QRCode.toBuffer(unit.qrCode, {
          width: 300,
          margin: 1,
        });
        const uploadResult = await uploadBufferToMinio({
          bucketName: qrBucketName,
          objectName: `qr/${unit.qrFilename}`,
          buffer,
          contentType: "image/png",
        });
        unit.qrImagePath = uploadResult.publicUrl;
      } catch (err) {
        console.warn(`MinIO upload skipped for ${unit.qrCode}:`, (err as Error).message);
        // keep placeholder path; client will still render preview via qrcode lib
      }
    }

    await db.itemUnit.createMany({
      data: unitsToCreate.map((unit) => ({
        itemId: unit.itemId,
        qrCode: unit.qrCode,
        notes: JSON.stringify({ qrImagePath: unit.qrImagePath }),
      })),
    });
    generated.push(
      ...unitsToCreate.map((unit) => ({
        itemName,
        qrCode: unit.qrCode,
        qrImagePath: unit.qrImagePath,
      }))
    );
  }

  return {
    success: `Berhasil generate ${generated.length} QR unit.`,
    generated: generated.slice(0, 140),
  };
}

