"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendPushToLocationAdmins } from "@/lib/push";

export type OutboundActionResult = {
  success?: boolean;
  error?: string;
  processedCodes?: string[];
};

export async function submitBarangKeluarAction(
  formData: FormData
): Promise<OutboundActionResult> {
  try {
    const locationId = String(formData.get("locationId") ?? "").trim();
    const mode = String(formData.get("mode") ?? "existing").trim();
    const existingItemId = String(formData.get("itemId") ?? "").trim();
    const recipient = String(formData.get("recipient") ?? "").trim();
    const target = String(formData.get("target") ?? "").trim();
    const reason = String(formData.get("reason") ?? "Afkir / Rusak Berat").trim();
    const referenceNo = String(formData.get("referenceNo") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const dateStr = String(formData.get("date") ?? "").trim();
    const txDate = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();

    if (!locationId) {
      return { error: "Lokasi tidak valid." };
    }

    if (!recipient) {
      return { error: "Nama penerima / penanggung jawab wajib diisi." };
    }

    // Condition mapping based on reason
    let newCondition = "good";
    if (reason.toLowerCase().includes("rusak") || reason.toLowerCase().includes("afkir")) {
      newCondition = "damaged";
    } else if (reason.toLowerCase().includes("hilang")) {
      newCondition = "lost";
    }

    let processedQrCodes: string[] = [];

    if (mode === "new") {
      const newItemName = String(formData.get("newItemName") ?? "").trim();
      const quantity = Number(String(formData.get("quantity") ?? "1"));

      if (!newItemName) {
        return { error: "Nama barang baru wajib diisi." };
      }
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 200) {
        return { error: "Jumlah unit harus antara 1 sampai 200." };
      }

      // Validasi ketersediaan barang di master barang
      const item = await db.item.findFirst({
        where: { name: newItemName, locationId },
        select: { id: true, name: true, stok: true },
      });

      if (!item) {
        return {
          error: `Barang "${newItemName}" belum terdaftar di Master Barang (stok tersedia: 0 unit). Barang tidak dapat dikeluarkan.`,
        };
      }

      const availableCount = await db.itemUnit.count({
        where: { itemId: item.id, status: "available" },
      });

      if (quantity > availableCount || item.stok < quantity) {
        return {
          error: `Jumlah yang dikeluarkan (${quantity} unit) melebihi stok yang tersedia (${Math.min(availableCount, item.stok)} unit). Stok tidak bisa berkurang melebihi jumlah yang tersedia.`,
        };
      }

      const unitsToRetire = await db.itemUnit.findMany({
        where: { itemId: item.id, status: "available" },
        take: quantity,
        select: { id: true, qrCode: true },
      });

      processedQrCodes = unitsToRetire.map((u) => u.qrCode);

      await db.$transaction(async (tx) => {
        await tx.itemUnit.updateMany({
          where: { id: { in: unitsToRetire.map((u) => u.id) } },
          data: {
            status: "retired",
            condition: newCondition,
          },
        });

        await tx.itemTransaction.create({
          data: {
            locationId,
            itemId: item.id,
            type: "out",
            quantity,
            referenceNo,
            source: reason,
            recipient,
            sender: target,
            notes,
            qrCodes: processedQrCodes,
            createdAt: txDate,
          },
        });

        // Decrement stok
        await tx.item.update({
          where: { id: item.id },
          data: { stok: Math.max(0, item.stok - quantity) },
        });
      });
    } else {
      if (!existingItemId) {
        return { error: "Pilih master barang yang akan dikeluarkan." };
      }

      const rawUnitIds = formData.getAll("unitIds").map((v) => String(v).trim()).filter(Boolean);
      if (rawUnitIds.length === 0) {
        return { error: "Minimal pilih 1 unit fisik (QR Code) yang dikeluarkan." };
      }

      // Pastikan stok tidak bisa berkurang melebihi jumlah yang tersedia
      const itemRecord = await db.item.findUnique({
        where: { id: existingItemId },
        select: { id: true, name: true, stok: true },
      });

      if (!itemRecord) {
        return { error: "Master barang tidak ditemukan." };
      }

      const availableCount = await db.itemUnit.count({
        where: { itemId: existingItemId, status: "available" },
      });

      if (rawUnitIds.length > availableCount || itemRecord.stok < rawUnitIds.length) {
        return {
          error: `Jumlah unit yang dipilih (${rawUnitIds.length} unit) melebihi stok tersedia (${Math.min(availableCount, itemRecord.stok)} unit). Stok tidak bisa berkurang melebihi jumlah yang tersedia.`,
        };
      }

      // Query units to ensure they belong to item and check status === 'available'
      const units = await db.itemUnit.findMany({
        where: {
          id: { in: rawUnitIds },
          itemId: existingItemId,
        },
        select: { id: true, qrCode: true, status: true },
      });

      if (units.length !== rawUnitIds.length) {
        return { error: "Sebagian unit yang dipilih tidak valid atau tidak ditemukan." };
      }

      // Requirement: Hanya boleh memproses unit dengan status tersedia (available)
      const nonAvailable = units.filter((u) => u.status !== "available");
      if (nonAvailable.length > 0) {
        return {
          error: `Unit ${nonAvailable.map((u) => u.qrCode).join(", ")} tidak berstatus 'available'. Hanya unit tersedia yang bisa dikeluarkan.`,
        };
      }

      processedQrCodes = units.map((u) => u.qrCode);

      await db.$transaction(async (tx) => {
        // Update item_units to retired
        await tx.itemUnit.updateMany({
          where: { id: { in: units.map((u) => u.id) } },
          data: {
            status: "retired",
            condition: newCondition,
          },
        });

        // Insert log transaksi (source = reason, sender = target)
        await tx.itemTransaction.create({
          data: {
            locationId,
            itemId: existingItemId,
            type: "out",
            quantity: units.length,
            referenceNo,
            source: reason,
            recipient,
            sender: target,
            notes,
            qrCodes: processedQrCodes,
            createdAt: txDate,
          },
        });

        // Decrement stok
        await tx.item.update({
          where: { id: existingItemId },
          data: { stok: Math.max(0, itemRecord.stok - units.length) },
        });
      });
    }

    revalidatePath("/admin/barang-keluar");
    revalidatePath("/admin/barang");
    revalidatePath("/admin/dashboard");

    // Get item name for notification
    const notifItem = mode === "new"
      ? String(formData.get("newItemName") ?? "Barang")
      : (await db.item.findUnique({ where: { id: existingItemId }, select: { name: true } }))?.name ?? "Barang";
    const qtyOut = processedQrCodes.length;
    sendPushToLocationAdmins(locationId, {
      title: "Barang Keluar",
      body: `${qtyOut} unit ${notifItem} keluar — ${reason}.`,
      url: "/admin/barang-keluar",
    }).catch(() => {});

    return {
      success: true,
      processedCodes: processedQrCodes,
    };
  } catch (err) {
    console.error("submitBarangKeluarAction error:", err);
    return { error: (err as Error).message || "Gagal memproses pengeluaran barang." };
  }
}

export async function updateBarangKeluarLogAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const referenceNo = String(formData.get("referenceNo") ?? "").trim() || null;
    const reason = String(formData.get("reason") ?? "").trim() || null;
    const recipient = String(formData.get("recipient") ?? "").trim();
    const target = String(formData.get("target") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const dateStr = String(formData.get("date") ?? "").trim();

    if (!id) return { error: "ID transaksi tidak valid." };
    if (!recipient) return { error: "Nama penerima wajib diisi." };

    await db.itemTransaction.update({
      where: { id },
      data: {
        referenceNo,
        source: reason,
        recipient,
        sender: target,
        notes,
        ...(dateStr ? { createdAt: new Date(`${dateStr}T12:00:00Z`) } : {}),
      },
    });

    revalidatePath("/admin/barang-keluar");
    return { success: true };
  } catch (err) {
    console.error("updateBarangKeluarLogAction error:", err);
    return { error: (err as Error).message || "Gagal mengubah riwayat transaksi." };
  }
}

export async function deleteBarangKeluarLogAction(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "ID transaksi tidak valid." };

    await db.itemTransaction.delete({
      where: { id },
    });

    revalidatePath("/admin/barang-keluar");
    return { success: true };
  } catch (err) {
    console.error("deleteBarangKeluarLogAction error:", err);
    return { error: (err as Error).message || "Gagal menghapus riwayat transaksi." };
  }
}
