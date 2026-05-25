import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { getAllLocationStats } from "@/lib/location-scope";
import { locationTypeLabel } from "@/lib/locations";
import { CreateLocationForm, CreateRegionalAdminForm } from "./forms";
import { LocationRowActions, AdminRowActions } from "./manage-rows";
import { MapPin, Users } from "lucide-react";

export default async function LokasiAdminPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const me = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { role: true },
  });
  if (me?.role !== "superadmin") redirect("/admin/dashboard");

  const [locations, stats, admins] = await Promise.all([
    db.location.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getAllLocationStats(),
    db.admin.findMany({
      where: { role: "admin", locationId: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        nip: true,
        locationId: true,
        location: { select: { name: true, slug: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const statsMap = new Map(stats.map((s) => [s.locationId, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Lokasi & Admin Daerah</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Super Admin: buat Pos SAR / KPP lain, tetapkan admin regional, pantau inventaris per
          daerah. Peminjaman internal memakai daftar Tim SAR yang sama (sumber KPP Padang) di semua
          lokasi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CreateLocationForm />
        <CreateRegionalAdminForm
          locations={locations.filter((l) => l.isActive).map((l) => ({
            id: l.id,
            name: l.name,
          }))}
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            Daftar Lokasi
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/80 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Nama</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Tipe</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Slug</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Tersedia</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Dipinjam</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Pending</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Status</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Panel</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const st = statsMap.get(loc.id);
                return (
                  <tr key={loc.id} className="border-b border-zinc-800/80 last:border-0">
                    <td className="px-4 py-2 text-zinc-100">{loc.name}</td>
                    <td className="px-4 py-2 text-zinc-400">{locationTypeLabel(loc.type)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-500">{loc.slug}</td>
                    <td className="px-4 py-2 text-emerald-300">{st?.available ?? 0}</td>
                    <td className="px-4 py-2 text-orange-300">{st?.borrowed ?? 0}</td>
                    <td className="px-4 py-2 text-amber-300">{st?.pendingLoans ?? 0}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${loc.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}
                      >
                        {loc.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={`/admin/dashboard?lokasi=${loc.slug}`}
                        className="text-xs text-orange-400 hover:text-orange-300"
                      >
                        Buka panel →
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <LocationRowActions
                        location={{
                          id: loc.id,
                          slug: loc.slug,
                          name: loc.name,
                          type: loc.type,
                          description: loc.description,
                          isActive: loc.isActive,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-400" />
            Admin Regional
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/80 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Nama</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Email</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Lokasi</th>
                <th className="px-4 py-2 text-left text-xs text-zinc-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-zinc-800/80 last:border-0">
                  <td className="px-4 py-2 text-zinc-100">{a.name}</td>
                  <td className="px-4 py-2 text-zinc-400">{a.email}</td>
                  <td className="px-4 py-2 text-zinc-300">
                    {a.location?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2">
                    <AdminRowActions
                      admin={{
                        id: a.id,
                        name: a.name,
                        email: a.email,
                        nip: a.nip,
                        locationId: a.locationId,
                      }}
                      locations={locations.map((l) => ({ id: l.id, name: l.name }))}
                    />
                  </td>
                </tr>
              ))}
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    Belum ada admin regional. Tambahkan via form di atas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
