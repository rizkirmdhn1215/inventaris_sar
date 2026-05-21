"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  adjustItemMaintenanceCount,
  adjustItemUnitCount,
} from "@/lib/inventory";

export async function upsertItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
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
    await db.item.create({
      data: { name, description, categoryId, merk, type, kodeGudang },
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
