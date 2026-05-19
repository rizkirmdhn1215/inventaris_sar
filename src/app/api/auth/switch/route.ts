import { NextResponse } from "next/server";
import {
  createSession,
  verifyAccountSwitchToken,
  createAccountSwitchToken,
} from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const adminId = String(body?.adminId ?? "").trim();
  const switchToken = String(body?.switchToken ?? "").trim();

  if (!adminId || !switchToken) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const payload = await verifyAccountSwitchToken(switchToken, adminId);
  if (!payload) {
    return NextResponse.json(
      { error: "Sesi akun kedaluwarsa. Silakan login ulang." },
      { status: 401 }
    );
  }

  const admin = await db.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true, imageUrl: true },
  });
  if (!admin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await createSession({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });

  const newSwitchToken = await createAccountSwitchToken({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    purpose: "account_switch",
  });

  return NextResponse.json({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    imageUrl: admin.imageUrl,
    role: admin.role,
    switchToken: newSwitchToken,
  });
}
