import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AdminShell } from "./admin-shell";
import {
  resolveAdminScope,
  getActiveLocations,
} from "@/lib/location-scope";

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
      locationId: true,
    },
  });

  if (!admin) redirect("/login");

  if (admin.role === "admin" && !admin.locationId) {
    redirect("/login?error=Akun%20belum%20ditetapkan%20ke%20lokasi");
  }

  const scope = await resolveAdminScope(
    { adminId: session.adminId, role: admin.role },
    null
  );
  const locations = await getActiveLocations();

  return (
    <AdminShell
      adminId={admin.id}
      adminName={admin.name}
      adminEmail={admin.email}
      adminImageUrl={admin.imageUrl}
      adminNip={admin.nip}
      adminRole={admin.role}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      isSuperAdmin={scope.isSuperAdmin}
      activeLocation={scope.activeLocation}
      locations={locations.map((l) => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        type: l.type,
      }))}
    >
      {children}
    </AdminShell>
  );
}
