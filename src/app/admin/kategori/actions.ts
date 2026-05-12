"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  try {
    await db.itemCategory.create({ data: { name } });
  } catch (e) {
    // ignore unique conflict
    console.error("createCategory error", e);
  }
  revalidatePath("/admin/kategori");
}

export async function renameCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  try {
    await db.itemCategory.update({ where: { id }, data: { name } });
  } catch (e) {
    console.error("renameCategory error", e);
  }
  revalidatePath("/admin/kategori");
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.itemCategory.delete({ where: { id } });
  } catch (e) {
    console.error("deleteCategory error", e);
  }
  revalidatePath("/admin/kategori");
}
