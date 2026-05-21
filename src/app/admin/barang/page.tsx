import Link from "next/link";
import { db } from "@/lib/db";
import { Package, Warehouse, ArrowRightLeft, Plus, AlertTriangle, Wrench } from "lucide-react";
import { upsertItemAction } from "./actions";
import { STATUS_COLOR } from "@/lib/format";
import { QrViewerButton } from "./qr-viewer";
import { EditableItemRow } from "./editable-row";
import { requireAdminPageScope } from "@/lib/admin-page";
import { appendLokasiQuery } from "@/lib/location-scope";

type BarangPageProps = {
  searchParams: Promise<{
    status?: string;
    tab?: string;
    lokasi?: string;
    q?: string;
    merk?: string;
    category?: string;
  }>;
};

export default async function BarangPage({ searchParams }: BarangPageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);
  const locId = scope.locationId;
  const tab = params.tab === "master" ? "master" : "units";
  const activeStatus =
    params.status === "borrowed"
      ? "borrowed"
      : params.status === "damaged"
        ? "damaged"
        : params.status === "maintenance"
          ? "maintenance"
          : "available";

  const searchQ = (params.q ?? "").trim();
  const searchMerk = (params.merk ?? "").trim();
  const searchCategory = (params.category ?? "").trim();

  const unitsWhere =
    activeStatus === "damaged"
      ? { condition: { in: ["damaged", "lost"] }, item: { locationId: locId } }
      : { status: activeStatus, item: { locationId: locId } };

  const masterWhere = {
    locationId: locId,
    ...(searchQ
      ? {
          OR: [
            { name: { contains: searchQ, mode: "insensitive" as const } },
            { description: { contains: searchQ, mode: "insensitive" as const } },
            { kodeGudang: { contains: searchQ, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(searchMerk
      ? { merk: { contains: searchMerk, mode: "insensitive" as const } }
      : {}),
    ...(searchCategory ? { categoryId: searchCategory } : {}),
  };

  const [
    availableCount,
    borrowedCount,
    damagedCount,
    maintenanceCount,
    units,
    items,
    categories,
  ] = await Promise.all([
    db.itemUnit.count({ where: { status: "available", item: { locationId: locId } } }),
    db.itemUnit.count({ where: { status: "borrowed", item: { locationId: locId } } }),
    db.itemUnit.count({
      where: { condition: { in: ["damaged", "lost"] }, item: { locationId: locId } },
    }),
    db.itemUnit.count({ where: { status: "maintenance", item: { locationId: locId } } }),
    db.itemUnit.findMany({
      where: unitsWhere,
      include: { item: { include: { category: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    db.item.findMany({
      where: masterWhere,
      include: {
        category: true,
        units: { select: { id: true, status: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.itemCategory.findMany({
      where: { locationId: locId },
      orderBy: { name: "asc" },
    }),
  ]);

  const masterFilterQs = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ tab: "master", lokasi: scope.activeLocation.slug, ...extra });
    if (searchQ) q.set("q", searchQ);
    if (searchMerk) q.set("merk", searchMerk);
    if (searchCategory) q.set("category", searchCategory);
    return q.toString();
  };

  const unitsTabHref = (status: string) =>
    appendLokasiQuery(`/admin/barang?tab=units&status=${status}`, scope.activeLocation.slug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Manajemen Barang</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Master barang (jenis) & unit fisik (per QR). Atur jumlah unit & maintenance per jenis.
        </p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800">
        <Link
          href={unitsTabHref("available")}
          className={`px-4 py-2 text-sm border-b-2 ${
            tab === "units" ? "border-orange-500 text-white" : "border-transparent text-zinc-400"
          }`}
        >
          Unit Fisik
        </Link>
        <Link
          href={`/admin/barang?${masterFilterQs({})}`}
          className={`px-4 py-2 text-sm border-b-2 ${
            tab === "master" ? "border-orange-500 text-white" : "border-transparent text-zinc-400"
          }`}
        >
          Master Barang
        </Link>
      </div>

      {tab === "master" ? (
        <div className="space-y-4">
          <form
            method="get"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 grid grid-cols-1 md:grid-cols-4 gap-2"
          >
            <input type="hidden" name="tab" value="master" />
            <input
              name="q"
              defaultValue={searchQ}
              placeholder="Cari nama / deskripsi / kode gudang"
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="merk"
              defaultValue={searchMerk}
              placeholder="Filter merk"
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <select
              name="category"
              defaultValue={searchCategory}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            >
              <option value="">Semua kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm text-white"
              >
                Cari
              </button>
              <Link
                href={`/admin/barang?${masterFilterQs({ tab: "master" })}`}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
              >
                Reset
              </Link>
            </div>
          </form>

          <form
            action={upsertItemAction}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 grid grid-cols-1 md:grid-cols-12 gap-2"
          >
            <input type="hidden" name="locationId" value={locId} />
            <input
              name="name"
              required
              placeholder="Nama barang"
              className="md:col-span-3 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <select
              name="categoryId"
              defaultValue=""
              className="md:col-span-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            >
              <option value="">Tanpa kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input
              name="merk"
              placeholder="Merk"
              className="md:col-span-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="type"
              placeholder="Type"
              className="md:col-span-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="kodeGudang"
              placeholder="Kode Gudang"
              className="md:col-span-2 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="md:col-span-1 inline-flex items-center justify-center gap-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-2 text-sm text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input
              name="description"
              placeholder="Deskripsi (opsional)"
              className="md:col-span-12 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </form>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-900/80 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Nama</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kategori</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Merk</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kode Gudang</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Deskripsi</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Total Unit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Tersedia</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Maintenance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const total = item.units.length;
                    const available = item.units.filter((u) => u.status === "available").length;
                    const borrowed = item.units.filter((u) => u.status === "borrowed").length;
                    const maintenance = item.units.filter((u) => u.status === "maintenance").length;
                    return (
                      <EditableItemRow
                        key={item.id}
                        item={{
                          id: item.id,
                          name: item.name,
                          description: item.description,
                          merk: item.merk,
                          type: item.type,
                          kodeGudang: item.kodeGudang,
                          categoryId: item.categoryId,
                          category: item.category ? { name: item.category.name } : null,
                          unitCount: total,
                          availableCount: available,
                          borrowedCount: borrowed,
                          maintenanceCount: maintenance,
                        }}
                        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                      />
                    );
                  })}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-500">
                        Tidak ada master barang sesuai filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href={unitsTabHref("available")}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                activeStatus === "available"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-zinc-100">Tersedia di Gudang</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-200">
                {availableCount}
              </span>
            </Link>
            <Link
              href={unitsTabHref("borrowed")}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                activeStatus === "borrowed"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-zinc-100">Sedang Dipinjam</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-200">
                {borrowedCount}
              </span>
            </Link>
            <Link
              href={unitsTabHref("maintenance")}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                activeStatus === "maintenance"
                  ? "border-violet-500/50 bg-violet-500/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-zinc-100">Maintenance</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-200">
                {maintenanceCount}
              </span>
            </Link>
            <Link
              href={unitsTabHref("damaged")}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                activeStatus === "damaged"
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-zinc-100">Rusak / Hilang</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-200">
                {damagedCount}
              </span>
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            {units.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-400">
                Belum ada data unit untuk status ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Barang</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kategori</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">QR Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kondisi</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => (
                      <tr key={unit.id} className="border-b border-zinc-800/80 last:border-0">
                        <td className="px-4 py-2 text-zinc-100">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-zinc-500" />
                            <span>{unit.item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-zinc-300">{unit.item.category?.name ?? "-"}</td>
                        <td className="px-4 py-2 text-zinc-300 font-mono text-xs">{unit.qrCode}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${STATUS_COLOR[unit.status] ?? "bg-zinc-800 text-zinc-200"}`}
                          >
                            {unit.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${STATUS_COLOR[unit.condition] ?? "bg-zinc-800 text-zinc-200"}`}
                          >
                            {unit.condition}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <QrViewerButton qrCode={unit.qrCode} itemName={unit.item.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
