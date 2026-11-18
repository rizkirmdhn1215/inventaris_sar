"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  adjustItemMaintenanceCount,
  adjustItemUnitCount,
} from "@/lib/inventory";

export async function upsertItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const merk = String(formData.get("merk") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "").trim() || null;
  const kodeGudang = String(formData.get("kodeGudang") ?? "").trim() || null;

  if (!name) return;

  if (id) {
    await db.item.update({
      where: { id },
      data: { name, description, categoryId, merk, type, kodeGudang },
    });
  } else {
    if (!locationId) return;
    await db.item.create({
      data: {
        locationId,
        name,
        description,
        categoryId,
        merk,
        type,
        kodeGudang,
      },
    });
  }
  revalidatePath("/admin/barang");
}

export async function deleteItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.item.delete({ where: { id } });
  } catch (e) {
    console.error("deleteItem error", e);
  }
  revalidatePath("/admin/barang");
}

export type InventoryActionResult = { error?: string; success?: string };

export async function adjustUnitCountAction(
  formData: FormData
): Promise<InventoryActionResult> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const targetCount = Number(String(formData.get("targetCount") ?? ""));
  if (!itemId) return { error: "ID barang tidak valid." };
  try {
    await adjustItemUnitCount(itemId, targetCount);
    revalidatePath("/admin/barang");
    return { success: "Jumlah unit diperbarui." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function adjustMaintenanceAction(
  formData: FormData
): Promise<InventoryActionResult> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const targetMaintenance = Number(String(formData.get("targetMaintenance") ?? ""));
  if (!itemId) return { error: "ID barang tidak valid." };
  try {
    await adjustItemMaintenanceCount(itemId, targetMaintenance);
    revalidatePath("/admin/barang");
    return { success: "Status maintenance diperbarui." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateUnitConditionAction(
  formData: FormData
): Promise<InventoryActionResult> {
  const unitId = String(formData.get("unitId") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();

  if (!unitId) return { error: "ID unit tidak valid." };
  if (!["good", "maintenance", "damaged", "lost"].includes(condition)) {
    return { error: "Kondisi tidak valid." };
  }

  try {
    const unit = await db.itemUnit.findUnique({
      where: { id: unitId },
      select: { status: true },
    });
    if (!unit) return { error: "Unit tidak ditemukan." };

    if (condition === "maintenance") {
      if (unit.status === "borrowed") {
        return {
          error: "Unit sedang dipinjam. Kembalikan terlebih dahulu sebelum masuk maintenance.",
        };
      }
      if (unit.status === "retired") {
        return { error: "Unit sudah tidak aktif (retired)." };
      }
    }

    let nextStatus = unit.status;
    let nextCondition = condition;
    if (condition === "maintenance") {
      nextStatus = "maintenance";
      // Keep DB condition clean ("good") so unit leaves Rusak/Hilang and enters Maintenance cleanly
      nextCondition = "good";
    } else if (unit.status !== "borrowed" && unit.status !== "retired") {
      if (condition === "damaged" || condition === "lost") {
        nextStatus = condition;
      } else if (
        condition === "good" &&
        (unit.status === "damaged" || unit.status === "lost" || unit.status === "maintenance")
      ) {
        nextStatus = "available";
      }
    }

    await db.itemUnit.update({
      where: { id: unitId },
      data: { condition: nextCondition, status: nextStatus },
    });
    revalidatePath("/admin/barang");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/barang-keluar");
    return { success: "Kondisi unit diperbarui." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

