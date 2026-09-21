"use client";

import { useState } from "react";
import { Plus, Trash2, Edit3, Check, X, Package, Layers } from "lucide-react";
import { updateLoanItemsAction } from "../actions";
import type { BorrowCatalogItem } from "@/lib/borrow-catalog";

export type EditableLoanItem = {
  itemId: string;
  name: string;
  merk: string | null;
  categoryName: string | null;
  quantity: number;
  availableCount: number;
};

export function LoanItemsEditor({
  loanId,
  initialItems,
  catalog,
}: {
  loanId: string;
  initialItems: EditableLoanItem[];
  catalog: BorrowCatalogItem[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<EditableLoanItem[]>(initialItems);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);

  // Available catalog items not currently in the loan
  const unselectedCatalog = catalog.filter(
    (cat) => !items.some((item) => item.itemId === cat.itemId)
  );

  const handleQuantityChange = (itemId: string, qty: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.itemId !== itemId) return it;
        const validQty = Math.max(1, Math.min(qty, it.availableCount));
        return { ...it, quantity: validQty };
      })
    );
  };

  const handleRemove = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.itemId !== itemId));
  };

  const handleAddItem = () => {
    if (!selectedCatalogId) return;
    const catItem = catalog.find((c) => c.itemId === selectedCatalogId);
    if (!catItem) return;

    setItems((prev) => [
      ...prev,
      {
        itemId: catItem.itemId,
        name: catItem.name,
        merk: catItem.merk,
        categoryName: catItem.categoryName,
        quantity: Math.max(1, Math.min(newQuantity, catItem.availableCount)),
        availableCount: catItem.availableCount,
      },
    ]);
    setSelectedCatalogId("");
    setNewQuantity(1);
  };

  const handleCancel = () => {
    setItems(initialItems);
    setIsEditing(false);
    setSelectedCatalogId("");
    setNewQuantity(1);
  };

  const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);

  if (!isEditing) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-medium text-white">
              Daftar Barang yang Diminta
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              {totalUnits} unit ({items.length} jenis)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Barang & Jumlah
          </button>
        </div>

        <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          {items.map((it) => (
            <div
              key={it.itemId}
              className="p-3 flex items-center justify-between text-sm"
            >
              <div>
                <p className="font-medium text-zinc-200">{it.name}</p>
                <p className="text-xs text-zinc-400">
                  {it.merk ? `Merk: ${it.merk} · ` : ""}
                  {it.categoryName ? `Kategori: ${it.categoryName}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-white px-2.5 py-1 rounded-lg bg-zinc-800">
                  {it.quantity} unit
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-zinc-900/90 p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-medium text-white">
            Sesuaikan Barang & Jumlah Peminjaman
          </h2>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="text-zinc-400 hover:text-zinc-200 text-xs inline-flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" /> Tutup
        </button>
      </div>

      <p className="text-xs text-zinc-400">
        Admin dapat mengubah jumlah unit, menghapus barang yang tidak disetujui, atau menambah barang lain dari gudang sebelum peminjaman disetujui.
      </p>

      {/* Form to submit changes */}
      <form action={updateLoanItemsAction} className="space-y-4">
        <input type="hidden" name="loanId" value={loanId} />

        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.itemId}
              className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <input type="hidden" name="borrowItemId" value={it.itemId} />
              <input
                type="hidden"
                name="borrowQuantity"
                value={String(it.quantity)}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {it.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {it.merk ? `Merk: ${it.merk} · ` : ""}
                  Tersedia di gudang:{" "}
                  <span className="text-emerald-400 font-medium">
                    {it.availableCount} unit
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-900 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuantityChange(it.itemId, it.quantity - 1)
                    }
                    disabled={it.quantity <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={it.availableCount}
                    value={it.quantity}
                    onChange={(e) =>
                      handleQuantityChange(
                        it.itemId,
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="w-12 text-center bg-transparent text-sm font-semibold text-white border-0 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleQuantityChange(it.itemId, it.quantity + 1)
                    }
                    disabled={it.quantity >= it.availableCount}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(it.itemId)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Hapus barang"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-4 text-center rounded-xl border border-dashed border-red-500/30 text-red-400 text-xs">
              Semua barang telah dihapus. Pilih minimal 1 barang untuk melanjutkan peminjaman.
            </div>
          )}
        </div>

        {/* Add item section */}
        {unselectedCatalog.length > 0 && (
          <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2">
            <p className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              Tambah barang lain dari gudang:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedCatalogId}
                onChange={(e) => {
                  setSelectedCatalogId(e.target.value);
                  setNewQuantity(1);
                }}
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="">-- Pilih barang tambahan --</option>
                {unselectedCatalog.map((cat) => (
                  <option key={cat.itemId} value={cat.itemId}>
                    {cat.name} {cat.merk ? `(${cat.merk})` : ""} — Tersedia: {cat.availableCount}
                  </option>
                ))}
              </select>

              {selectedCatalogId && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={
                      catalog.find((c) => c.itemId === selectedCatalogId)
                        ?.availableCount ?? 1
                    }
                    value={newQuantity}
                    onChange={(e) =>
                      setNewQuantity(parseInt(e.target.value) || 1)
                    }
                    className="w-16 rounded-xl bg-zinc-900 border border-zinc-700 px-2 py-2 text-xs text-center text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-2 text-xs font-medium rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-zinc-400">
            Total unit: <strong className="text-white">{totalUnits}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan Perubahan Barang
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
