"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { uploadBufferToMinio, MINIO_BUCKETS } from "@/lib/minio";
import { getNextQrCodes } from "@/lib/inventory";
import { sendPushToLocationAdmins } from "@/lib/push";

export type InboundActionResult = {
  success?: boolean;
  error?: string;
  generatedCodes?: string[];
  item?: {
    id: string;
    name: string;
    categoryName: string | null;
    merk: string | null;
  };
};

export async function submitBarangMasukAction(
  formData: FormData
): Promise<InboundActionResult> {
  try {
    const locationId = String(formData.get("locationId") ?? "").trim();
    const mode = String(formData.get("mode") ?? "existing").trim();
    const existingItemId = String(formData.get("itemId") ?? "").trim();
    const newItemName = String(formData.get("newItemName") ?? "").trim();
    const newItemCategory = String(formData.get("newItemCategory") ?? "").trim() || null;
    const quantity = Number(String(formData.get("quantity") ?? "1"));
    const source = String(formData.get("source") ?? "Pengadaan Baru").trim();
    const referenceNo = String(formData.get("referenceNo") ?? "").trim() || null;
    const recipient = String(formData.get("recipient") ?? "").trim() || null;
    const sender = String(formData.get("sender") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const dateStr = String(formData.get("date") ?? "").trim();
    const txDate = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();

    if (!locationId) {
      return { error: "Lokasi tidak valid." };
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 200) {
      return { error: "Jumlah unit harus antara 1 sampai 200." };
    }

    let targetItem: { id: string; name: string };

    if (mode === "new") {
      if (!newItemName) {
        return { error: "Nama barang baru wajib diisi." };
      }

      // ponytail: cek existing by name pada lokasi yang sama, create jika belum ada
      const existing = await db.item.findFirst({
        where: { name: newItemName, locationId },
        select: { id: true, name: true },
      });

      if (existing) {
        targetItem = existing;
      } else {
        const created = await db.item.create({
          data: {
            locationId,
            name: newItemName,
            categoryId: newItemCategory,
          },
          select: { id: true, name: true },
        });
        targetItem = created;
      }
    } else {
      if (!existingItemId) {
        return { error: "Silakan pilih master barang." };
      }
      const item = await db.item.findUnique({
        where: { id: existingItemId },
        select: { id: true, name: true, locationId: true },
      });
      if (!item || item.locationId !== locationId) {
        return { error: "Barang tidak ditemukan di lokasi ini." };
      }
      targetItem = item;
    }

    // Generate QR codes
    const qrCodes = await getNextQrCodes(targetItem.id, targetItem.name, quantity);

    const qrBucketName = MINIO_BUCKETS.qrs || "item-qrs";
    const unitsData: { itemId: string; qrCode: string; notes: string; status: string; condition: string }[] = [];

    for (const code of qrCodes) {
      const qrFilename = `${code.replace(/[^A-Z0-9-]/gi, "_")}.png`;
      let publicUrl = `/qr-storage/${qrFilename}`;

      try {
        const buffer = await QRCode.toBuffer(code, { width: 300, margin: 1 });
        const uploadResult = await uploadBufferToMinio({
          bucketName: qrBucketName,
          objectName: `qr/${qrFilename}`,
          buffer,
          contentType: "image/png",
        });
        publicUrl = uploadResult.publicUrl;
      } catch (err) {
        console.warn(`MinIO upload skip for ${code}:`, (err as Error).message);
      }

      unitsData.push({
        itemId: targetItem.id,
        qrCode: code,
        status: "available",
        condition: "good",
        notes: JSON.stringify({ qrImagePath: publicUrl, source, referenceNo }),
      });
    }

    // Database transaction: Insert item_units & item_transactions
    await db.$transaction(async (tx) => {
      await tx.itemUnit.createMany({
        data: unitsData,
      });

      await tx.itemTransaction.create({
        data: {
          locationId,
          itemId: targetItem.id,
          type: "in",
          quantity,
          referenceNo,
          source,
          recipient,
          sender,
          notes,
          qrCodes,
          createdAt: txDate,
        },
      });

      // Increment stok
      await tx.item.update({
        where: { id: targetItem.id },
        data: { stok: { increment: quantity } },
      });
    });

    revalidatePath("/admin/barang-masuk");
    revalidatePath("/admin/barang");
    revalidatePath("/admin/dashboard");

    // Push notification for barang masuk
    sendPushToLocationAdmins(locationId, {
      title: "Barang Masuk",
      body: `${quantity} unit ${targetItem.name} masuk dari ${source}.`,
      url: "/admin/barang-masuk",
    }).catch(() => {});

    const resolvedItem = await db.item.findUnique({
      where: { id: targetItem.id },
      include: { category: { select: { name: true } } },
    });

    return {
      success: true,
      generatedCodes: qrCodes,
      item: resolvedItem
        ? {
            id: resolvedItem.id,
            name: resolvedItem.name,
            categoryName: resolvedItem.category?.name ?? null,
            merk: resolvedItem.merk,
          }
        : undefined,
    };
  } catch (err) {
    console.error("submitBarangMasukAction error:", err);
    return { error: (err as Error).message || "Gagal menyimpan barang masuk." };
  }
}

export async function updateBarangMasukLogAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const referenceNo = String(formData.get("referenceNo") ?? "").trim() || null;
    const source = String(formData.get("source") ?? "").trim() || null;
    const recipient = String(formData.get("recipient") ?? "").trim() || null;
    const sender = String(formData.get("sender") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const dateStr = String(formData.get("date") ?? "").trim();

    if (!id) return { error: "ID transaksi tidak valid." };

    await db.itemTransaction.update({
      where: { id },
      data: {
        referenceNo,
        source,
        recipient,
        sender,
        notes,
        ...(dateStr ? { createdAt: new Date(`${dateStr}T12:00:00Z`) } : {}),
      },
    });

    revalidatePath("/admin/barang-masuk");
    return { success: true };
  } catch (err) {
    console.error("updateBarangMasukLogAction error:", err);
    return { error: (err as Error).message || "Gagal mengubah data riwayat." };
  }
}

export async function deleteBarangMasukLogAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "ID transaksi tidak valid." };

    await db.itemTransaction.delete({
      where: { id },
    });

    revalidatePath("/admin/barang-masuk");
    return { success: true };
  } catch (err) {
    console.error("deleteBarangMasukLogAction error:", err);
    return { error: (err as Error).message || "Gagal menghapus riwayat." };
  }
}
