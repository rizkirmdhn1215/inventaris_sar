import { db } from "@/lib/db";
import { Tags, Trash2, Save, Plus } from "lucide-react";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from "./actions";
import { requireAdminPageScope } from "@/lib/admin-page";

type KategoriPageProps = {
  searchParams: Promise<{ lokasi?: string }>;
};

export default async function KategoriPage({ searchParams }: KategoriPageProps) {
  const params = await searchParams;
  const { scope } = await requireAdminPageScope(params.lokasi);

  const categories = await db.itemCategory.findMany({
    where: { locationId: scope.locationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Kategori Barang</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Kategori untuk <strong className="text-zinc-300">{scope.activeLocation.name}</strong>.
        </p>
      </div>

      <form
        action={createCategoryAction}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row gap-2"
      >
        <input type="hidden" name="locationId" value={scope.locationId} />
        <input
          name="name"
          required
          placeholder="Nama kategori baru (contoh: Komunikasi)"
          className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="w-4 h-4" />
          Tambah Kategori
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Nama</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Barang</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-zinc-800/80 last:border-0">
                <td className="px-4 py-2">
                  <form action={renameCategoryAction} className="flex gap-2">
                    <input type="hidden" name="id" value={cat.id} />
                    <input
                      name="name"
                      defaultValue={cat.name}
                      className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 text-sm text-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-xs text-emerald-300"
                    >
                      <Save className="w-3.5 h-3.5" /> Simpan
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 text-zinc-300">{cat._count.items}</td>
                <td className="px-4 py-2">
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={cat.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-xs text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-zinc-500">
                  Belum ada kategori di lokasi ini.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
