"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createSession,
  verifySession,
  createAccountSwitchToken,
  verifyAccountSwitchToken,
  setSessionCookie,
  encrypt,
} from "@/lib/auth/session";
import { uploadBufferToMinio, MINIO_BUCKETS } from "@/lib/minio";

async function requireAdmin() {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      email: true,
      name: true,
      nip: true,
      imageUrl: true,
      role: true,
      locationId: true,
    },
  });
  if (!admin) throw new Error("Admin not found");
  return { session, admin };
}

export type AccountActionState = {
  error?: string;
  success?: string;
  name?: string;
  nip?: string | null;
  imageUrl?: string | null;
};

export async function updateProfileAction(
  _prev: AccountActionState | null,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const { session, admin } = await requireAdmin();
    const passwordRow = await db.admin.findUnique({
      where: { id: admin.id },
      select: { password: true },
    });
    if (!passwordRow) {
      return { error: "Gagal memverifikasi akun." };
    }
    const name = String(formData.get("name") ?? "").trim();
    const nip = String(formData.get("nip") ?? "").trim() || null;
    const removeImage = formData.get("removeImage") === "true";
    const imageFile = formData.get("image");
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "").trim();
    const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

    if (!name) {
      return { error: "Nama wajib diisi." };
    }

    const wantsPasswordChange =
      currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    if (wantsPasswordChange) {
      if (!currentPassword) {
        return { error: "Masukkan password saat ini untuk mengganti password." };
      }
      if (!newPassword) {
        return { error: "Masukkan password baru." };
      }
      if (newPassword.length < 8) {
        return { error: "Password baru minimal 8 karakter." };
      }
      if (newPassword !== confirmPassword) {
        return { error: "Konfirmasi password tidak cocok." };
      }
      const valid = await compare(currentPassword, passwordRow.password);
      if (!valid) {
        return { error: "Password saat ini salah." };
      }
    }

    let imageUrl = admin.imageUrl;

    if (removeImage) {
      imageUrl = null;
    } else if (imageFile instanceof File && imageFile.size > 0) {
      if (!imageFile.type.startsWith("image/")) {
        return { error: "File harus berupa gambar." };
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        return { error: "Ukuran gambar maksimal 5 MB." };
      }
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const objectName = `${admin.id}/avatar-${Date.now()}.${ext}`;
      try {
        const result = await uploadBufferToMinio({
          bucketName: MINIO_BUCKETS.avatars,
          objectName,
          buffer,
          contentType: imageFile.type || "image/jpeg",
        });
        imageUrl = result.publicUrl;
      } catch (e) {
        console.warn("Avatar upload skipped:", (e as Error).message);
        return { error: "Gagal mengunggah foto profil. Cek konfigurasi MinIO." };
      }
    }

    const updated = await db.admin.update({
      where: { id: admin.id },
      data: {
        name,
        nip,
        imageUrl,
        ...(wantsPasswordChange
          ? { password: await hash(newPassword, 12) }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        nip: true,
        imageUrl: true,
        role: true,
        locationId: true,
      },
    });

    const sessionToken = await encrypt({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      ...(updated.locationId ? { locationId: updated.locationId } : {}),
    });
    await setSessionCookie(sessionToken);

    revalidatePath("/admin", "layout");
    return {
      success: "Profil berhasil diperbarui.",
      name: updated.name,
      nip: updated.nip,
      imageUrl: updated.imageUrl,
    };
  } catch {
    return { error: "Gagal memperbarui profil." };
  }
}

export async function createAdminAction(
  _prev: AccountActionState | null,
  formData: FormData
): Promise<AccountActionState> {
  try {
    const { admin } = await requireAdmin();
    if (admin.role !== "superadmin") {
      return { error: "Hanya Super Admin yang dapat menambah admin." };
    }

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const roleRaw = String(formData.get("role") ?? "admin").trim();
    const role = roleRaw === "superadmin" ? "superadmin" : "admin";
    const locationId = String(formData.get("locationId") ?? "").trim() || null;

    if (!name || !email || !password) {
      return { error: "Nama, email, dan password wajib diisi." };
    }
    if (password.length < 8) {
      return { error: "Password minimal 8 karakter." };
    }

    const existing = await db.admin.findUnique({ where: { email } });
    if (existing) {
      return { error: "Email sudah terdaftar." };
    }

    if (role === "admin" && !locationId) {
      return { error: "Admin regional wajib ditetapkan ke lokasi." };
    }

    const hashedPassword = await hash(password, 12);
    await db.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        locationId: role === "superadmin" ? null : locationId,
      },
    });

    revalidatePath("/admin", "layout");
    return { success: `Admin ${email} berhasil ditambahkan.` };
  } catch {
    return { error: "Gagal menambah admin." };
  }
}

export async function switchAccountAction(formData: FormData) {
  const targetAdminId = String(formData.get("adminId") ?? "").trim();
  const switchToken = String(formData.get("switchToken") ?? "").trim();

  if (!targetAdminId || !switchToken) {
    return { error: "Akun tidak valid." };
  }

  const payload = await verifyAccountSwitchToken(switchToken, targetAdminId);
  if (!payload) {
    return { error: "Sesi akun kedaluwarsa. Silakan login ulang." };
  }

  const admin = await db.admin.findUnique({
    where: { id: targetAdminId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      imageUrl: true,
      locationId: true,
    },
  });
  if (!admin) {
    return { error: "Akun tidak ditemukan." };
  }

  await createSession({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    ...(admin.locationId ? { locationId: admin.locationId } : {}),
  });

  return {
    success: true,
    account: {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      imageUrl: admin.imageUrl,
      role: admin.role,
      switchToken: await createAccountSwitchToken({
        sub: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        purpose: "account_switch",
      }),
    },
  };
}

export async function getAccountSnapshotAction() {
  const session = await verifySession();
  if (!session) return null;

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, name: true, nip: true, imageUrl: true, role: true },
  });
  if (!admin) return null;

  const switchToken = await createAccountSwitchToken({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    purpose: "account_switch",
  });

  return {
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    imageUrl: admin.imageUrl,
    role: admin.role,
    switchToken,
  };
}
