'use server';

import { db } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { compare } from 'bcryptjs';
import { redirect } from 'next/navigation';

export type LoginActionState = {
  error?: string;
  email?: string;
};

export async function loginAction(
  _prevState: LoginActionState | null,
  formData: FormData
) {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.', email };
  }

  try {
    const admin = await db.admin.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        locationId: true,
      },
    });

    if (!admin) {
      return { error: 'Email atau password salah.', email };
    }

    const isPasswordValid = await compare(password, admin.password);

    if (!isPasswordValid) {
      return { error: 'Email atau password salah.', email };
    }

    if (admin.role === "admin" && !admin.locationId) {
      return {
        error: "Akun admin belum ditetapkan ke lokasi. Hubungi Super Admin.",
        email,
      };
    }

    await createSession({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role ?? "admin",
      ...(admin.locationId ? { locationId: admin.locationId } : {}),
    });

  } catch (error) {
    console.error('Login error:', error);
    return { error: 'Terjadi kesalahan sistem. Silakan coba lagi.', email };
  }

  // Redirect happens outside the try-catch to avoid interfering with Next.js navigation error handling
  redirect('/admin/dashboard');
}
