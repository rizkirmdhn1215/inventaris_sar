import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminShell } from "./admin-shell";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await verifySession();
  if (!session) redirect("/login");

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      nip: true,
      role: true,
    },
  });

  if (!admin) redirect("/login");

  return (
    <AdminShell
      adminId={admin.id}
      adminName={admin.name}
      adminEmail={admin.email}
      adminImageUrl={admin.imageUrl}
      adminNip={admin.nip}
      adminRole={admin.role}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    >
      {children}
    </AdminShell>
  );
}
