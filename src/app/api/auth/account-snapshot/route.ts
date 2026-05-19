import { NextResponse } from "next/server";
import { verifySession, createAccountSwitchToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, name: true, imageUrl: true, role: true },
  });
  if (!admin) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const switchToken = await createAccountSwitchToken({
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
    switchToken,
  });
}
