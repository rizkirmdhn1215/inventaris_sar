"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function upsertItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  if (!name) return;

  if (id) {
    await db.item.update({
      where: { id },
      data: { name, description, categoryId },
    });
  } else {
    await db.item.create({
      data: { name, description, categoryId },
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
