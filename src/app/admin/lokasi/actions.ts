"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/session";
import { hash } from "bcryptjs";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

async function requireSuperAdmin() {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { role: true },
  });
  if (!admin || admin.role !== "superadmin") {
    throw new Error("Hanya Super Admin.");
  }
  return session;
}

export type LokasiActionState = { error?: string; success?: string };

export async function createLocationAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "pos").trim() === "kpp" ? "kpp" : "pos";
    const description = String(formData.get("description") ?? "").trim() || null;
    const slugRaw = String(formData.get("slug") ?? "").trim();
    const slug = slugRaw || slugify(name);

    if (!name) return { error: "Nama lokasi wajib diisi." };

    const exists = await db.location.findUnique({ where: { slug } });
    if (exists) return { error: `Slug "${slug}" sudah dipakai.` };

    const maxOrder = await db.location.aggregate({ _max: { sortOrder: true } });
    await db.location.create({
      data: {
        name,
        slug,
        type,
        description,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    revalidatePath("/admin/lokasi");
    revalidatePath("/");
    return { success: `Lokasi ${name} berhasil dibuat.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateLocationAction(formData: FormData): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "pos").trim() === "kpp" ? "kpp" : "pos";
    const description = String(formData.get("description") ?? "").trim() || null;
    const isActive = formData.get("isActive") === "true";

    if (!id || !name) return { error: "Data tidak lengkap." };

    await db.location.update({
      where: { id },
      data: { name, type, description, isActive },
    });

    revalidatePath("/admin/lokasi");
    revalidatePath("/");
    return { success: "Lokasi diperbarui." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createRegionalAdminAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const locationId = String(formData.get("locationId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!locationId || !name || !email || !password) {
      return { error: "Semua field wajib diisi." };
    }
    if (password.length < 8) return { error: "Password minimal 8 karakter." };

    const existing = await db.admin.findUnique({ where: { email } });
    if (existing) return { error: "Email sudah terdaftar." };

    await db.admin.create({
      data: {
        name,
        email,
        password: await hash(password, 12),
        role: "admin",
        locationId,
      },
    });

    revalidatePath("/admin/lokasi");
    return { success: `Admin ${email} ditambahkan untuk lokasi ini.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
