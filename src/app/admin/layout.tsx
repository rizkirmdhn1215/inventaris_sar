import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { AdminShell } from "./admin-shell";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await verifySession();
  if (!session) redirect("/login");

  return (
    <AdminShell
      adminName={session.name}
      adminEmail={session.email}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    >
      {children}
    </AdminShell>
  );
}
