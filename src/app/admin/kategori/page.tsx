import { db } from "@/lib/db";
import { Tags, Trash2, Save, Plus } from "lucide-react";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from "./actions";

export default async function KategoriPage() {
  const categories = await db.itemCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Kategori Barang</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Kelola jenis kategori untuk pengelompokan barang.
        </p>
      </div>

      <form
        action={createCategoryAction}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col sm:flex-row gap-2"
      >
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
        <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-300 flex items-center gap-2">
          <Tags className="w-4 h-4 text-orange-400" /> {categories.length} kategori
        </div>
        {categories.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            Belum ada kategori.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {categories.map((cat) => (
              <li key={cat.id} className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                <form action={renameCategoryAction} className="flex-1 flex gap-2">
                  <input type="hidden" name="id" value={cat.id} />
                  <input
                    name="name"
                    defaultValue={cat.name}
                    className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 hover:border-zinc-600 px-3 py-2 text-xs text-zinc-100"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan
                  </button>
                </form>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 px-2 py-1 rounded-full bg-zinc-800">
                    {cat._count.items} barang
                  </span>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={cat.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 text-red-300 hover:bg-red-950/40 px-3 py-2 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
