import Link from "next/link";
import { db } from "@/lib/db";
import { Package, Warehouse, ArrowRightLeft, Plus, Trash2, AlertTriangle } from "lucide-react";
import { upsertItemAction, deleteItemAction } from "./actions";
import { STATUS_COLOR } from "@/lib/format";
import { QrViewerButton } from "./qr-viewer";

type BarangPageProps = {
  searchParams: Promise<{ status?: string; tab?: string }>;
};

function getQrImagePath(notes: string | null, qrCode: string) {
  try {
    const parsed = notes ? (JSON.parse(notes) as { qrImagePath?: string }) : null;
    if (parsed?.qrImagePath) return parsed.qrImagePath;
  } catch {}
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT || "9000";
  const useSSL = process.env.MINIO_USE_SSL === "true";
  const bucket = process.env.MINIO_BUCKET_QRS || "item-qrs";
  if (!endpoint) return null;
  const filename = `${qrCode.replace(/[^A-Z0-9-]/gi, "_")}.png`;
  return `${useSSL ? "https" : "http"}://${endpoint}:${port}/${bucket}/qr/${filename}`;
}

export default async function BarangPage({ searchParams }: BarangPageProps) {
  const params = await searchParams;
  const tab = params.tab === "master" ? "master" : "units";
  const activeStatus =
    params.status === "borrowed"
      ? "borrowed"
      : params.status === "damaged"
        ? "damaged"
        : "available";

  const unitsWhere =
    activeStatus === "damaged"
      ? { condition: { in: ["damaged", "lost"] } }
      : { status: activeStatus };

  const [availableCount, borrowedCount, damagedCount, units, items, categories] = await Promise.all([
    db.itemUnit.count({ where: { status: "available" } }),
    db.itemUnit.count({ where: { status: "borrowed" } }),
    db.itemUnit.count({ where: { condition: { in: ["damaged", "lost"] } } }),
    db.itemUnit.findMany({
      where: unitsWhere,
      include: { item: { include: { category: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    db.item.findMany({
      include: {
        category: true,
        _count: { select: { units: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.itemCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Manajemen Barang</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Master barang (jenis) & unit fisik (per QR).
        </p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800">
        <Link
          href="/admin/barang?tab=units&status=available"
          className={`px-4 py-2 text-sm border-b-2 ${
            tab === "units" ? "border-orange-500 text-white" : "border-transparent text-zinc-400"
          }`}
        >
          Unit Fisik
        </Link>
        <Link
          href="/admin/barang?tab=master"
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
            action={upsertItemAction}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 grid grid-cols-1 md:grid-cols-12 gap-2"
          >
            <input
              name="name"
              required
              placeholder="Nama barang (contoh: Chainsaw)"
              className="md:col-span-4 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="description"
              placeholder="Deskripsi (opsional)"
              className="md:col-span-5 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
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
            <button
              type="submit"
              className="md:col-span-1 inline-flex items-center justify-center gap-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-2 text-sm text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-900/80 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Nama</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kategori</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Deskripsi</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Unit</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-800/80 last:border-0">
                      <td className="px-4 py-2 text-zinc-100">{item.name}</td>
                      <td className="px-4 py-2 text-zinc-300">{item.category?.name ?? "-"}</td>
                      <td className="px-4 py-2 text-zinc-400 max-w-xs truncate">{item.description ?? "-"}</td>
                      <td className="px-4 py-2 text-zinc-300">{item._count.units}</td>
                      <td className="px-4 py-2">
                        <form action={deleteItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                        Belum ada master barang.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/admin/barang?tab=units&status=available"
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
              href="/admin/barang?tab=units&status=borrowed"
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
              href="/admin/barang?tab=units&status=damaged"
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
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${STATUS_COLOR[unit.condition] ?? "bg-zinc-800 text-zinc-200"}`}>
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
