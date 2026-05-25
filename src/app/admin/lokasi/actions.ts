"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/session";
import { hash } from "bcryptjs";
import { copyInternalBorrowersToLocation } from "@/lib/internal-borrowers";
import { PROTECTED_LOCATION_ID, type LokasiActionState } from "./constants";

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
    const created = await db.location.create({
      data: {
        name,
        slug,
        type,
        description,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    const rosterCopied = await copyInternalBorrowersToLocation(created.id);

    revalidatePath("/admin/lokasi");
    revalidatePath("/");
    return {
      success: `Lokasi ${name} berhasil dibuat. Daftar peminjam internal (${rosterCopied} orang) disalin dari KPP Padang.`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateLocationAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const slugRaw = String(formData.get("slug") ?? "").trim();
    const type = String(formData.get("type") ?? "pos").trim() === "kpp" ? "kpp" : "pos";
    const description = String(formData.get("description") ?? "").trim() || null;
    const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";

    if (!id || !name) return { error: "Data tidak lengkap." };

    const loc = await db.location.findUnique({ where: { id } });
    if (!loc) return { error: "Lokasi tidak ditemukan." };

    const slug = slugRaw || loc.slug;
    if (slug !== loc.slug) {
      const taken = await db.location.findFirst({
        where: { slug, NOT: { id } },
      });
      if (taken) return { error: `Slug "${slug}" sudah dipakai.` };
    }

    await db.location.update({
      where: { id },
      data: { name, slug, type, description, isActive },
    });

    revalidatePath("/admin/lokasi");
    revalidatePath("/");
    revalidatePath("/admin", "layout");
    return { success: "Lokasi diperbarui." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteLocationAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "ID lokasi tidak valid." };

    if (id === PROTECTED_LOCATION_ID) {
      return { error: "KPP Padang tidak boleh dihapus." };
    }

    const loc = await db.location.findUnique({ where: { id } });
    if (!loc) return { error: "Lokasi tidak ditemukan." };

    const [itemCount, loanCount, activeLoanCount] = await Promise.all([
      db.item.count({ where: { locationId: id } }),
      db.loan.count({ where: { locationId: id } }),
      db.loan.count({
        where: { locationId: id, status: { in: ["pending", "approved"] } },
      }),
    ]);

    if (itemCount > 0 || loanCount > 0) {
      return {
        error:
          `Lokasi "${loc.name}" masih berisi ${itemCount} master barang dan ${loanCount} riwayat pinjam` +
          (activeLoanCount > 0 ? ` (${activeLoanCount} masih aktif)` : "") +
          `. Nonaktifkan lokasi jika tidak dipakai, atau kosongkan data terlebih dahulu.`,
      };
    }

    await db.$transaction([
      db.pushSubscription.deleteMany({ where: { locationId: id } }),
      db.admin.deleteMany({ where: { locationId: id, role: "admin" } }),
      db.location.delete({ where: { id } }),
    ]);

    revalidatePath("/admin/lokasi");
    revalidatePath("/");
    revalidatePath("/admin", "layout");
    return { success: `Lokasi "${loc.name}" berhasil dihapus.` };
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

export async function updateRegionalAdminAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    await requireSuperAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const locationId = String(formData.get("locationId") ?? "").trim();
    const newPassword = String(formData.get("newPassword") ?? "").trim();
    const nip = String(formData.get("nip") ?? "").trim() || null;

    if (!id || !name || !email || !locationId) {
      return { error: "Nama, email, dan lokasi wajib diisi." };
    }

    const target = await db.admin.findUnique({ where: { id } });
    if (!target) return { error: "Admin tidak ditemukan." };
    if (target.role !== "admin") {
      return { error: "Hanya akun admin regional yang bisa diedit di sini." };
    }

    const emailTaken = await db.admin.findFirst({
      where: { email, NOT: { id } },
    });
    if (emailTaken) return { error: "Email sudah dipakai akun lain." };

    const location = await db.location.findUnique({ where: { id: locationId } });
    if (!location) return { error: "Lokasi tidak valid." };

    if (newPassword && newPassword.length < 8) {
      return { error: "Password baru minimal 8 karakter." };
    }

    await db.admin.update({
      where: { id },
      data: {
        name,
        email,
        nip,
        locationId,
        ...(newPassword ? { password: await hash(newPassword, 12) } : {}),
      },
    });

    revalidatePath("/admin/lokasi");
    revalidatePath("/admin", "layout");
    return { success: `Admin ${email} diperbarui.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteRegionalAdminAction(
  _prev: LokasiActionState | null,
  formData: FormData
): Promise<LokasiActionState> {
  try {
    const session = await requireSuperAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "ID admin tidak valid." };

    if (id === session.adminId) {
      return { error: "Tidak bisa menghapus akun yang sedang dipakai." };
    }

    const target = await db.admin.findUnique({ where: { id } });
    if (!target) return { error: "Admin tidak ditemukan." };
    if (target.role === "superadmin") {
      return { error: "Akun Super Admin tidak bisa dihapus dari halaman ini." };
    }

    await db.pushSubscription.deleteMany({ where: { adminId: id } });
    await db.admin.delete({ where: { id } });

    revalidatePath("/admin/lokasi");
    revalidatePath("/admin", "layout");
    return { success: `Admin ${target.email} dihapus.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
