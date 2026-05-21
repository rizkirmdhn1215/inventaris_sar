import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  type SubBody = {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh, keys.auth required" },
      { status: 400 }
    );
  }

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { locationId: true, role: true },
  });

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: {
      p256dh,
      auth,
      adminId: session.adminId,
      locationId: admin?.role === "superadmin" ? null : admin?.locationId ?? null,
    },
    create: {
      endpoint,
      p256dh,
      auth,
      adminId: session.adminId,
      locationId: admin?.role === "superadmin" ? null : admin?.locationId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
