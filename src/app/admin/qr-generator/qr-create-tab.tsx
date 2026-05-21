"use client";

import { useActionState, useEffect, useState } from "react";
import { generateQrAction } from "./actions";
import QRCode from "qrcode";
import { QrPrintGrid } from "./qr-print-grid";
import { QrPrintStyles } from "./qr-print-styles";
import type { QrLabelEntry } from "./constants";

type Category = { id: string; name: string };

export function QrCreateTab({
  locationId,
  categories,
}: {
  locationId: string;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(generateQrAction, null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [rows, setRows] = useState([{ id: 1 }]);

  const labels: QrLabelEntry[] =
    state?.generated?.map((e) => ({ qrCode: e.qrCode, itemName: e.itemName })) ?? [];

  useEffect(() => {
    const generated = state?.generated;
    if (!generated?.length) {
      setImages({});
      return;
    }

    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        generated.map(async (entry) => {
          const dataUrl = await QRCode.toDataURL(entry.qrCode, { width: 200, margin: 1 });
          return [entry.qrCode, dataUrl] as const;
        })
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [state?.generated]);

  return (
    <div className="space-y-4">
      <QrPrintStyles rootClass="qr-print-create-root" />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 print:hidden">
        <p className="text-sm text-zinc-400 mb-4">
          Isi per baris: nama barang, kategori, jumlah unit baru. Barang yang sudah ada akan
          ditambah unit berikutnya.
        </p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locationId" value={locationId} />
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-zinc-800 p-3"
              >
                <div className="sm:col-span-5">
                  <label className="block text-xs text-zinc-400 mb-1">
                    Nama barang #{index + 1}
                  </label>
                  <input
                    name="itemName"
                    required
                    placeholder="Contoh: Chainsaw"
                    className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1">Kategori</label>
                  <select
                    name="categoryId"
                    defaultValue=""
                    className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">- Tanpa kategori -</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Jumlah</label>
                  <input
                    type="number"
                    name="quantity"
                    min={1}
                    max={200}
                    defaultValue={1}
                    required
                    className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) =>
                        prev.length === 1
                          ? prev
                          : prev.filter((entry) => entry.id !== row.id)
                      )
                    }
                    disabled={rows.length === 1}
                    className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>

          {state?.error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {state?.success && (
            <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">
              {state.success}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [...prev, { id: Date.now() + prev.length }])
              }
              className="rounded-xl border border-zinc-700 hover:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100"
            >
              + Tambah Baris Barang
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
            >
              {pending ? "Memproses..." : "Generate QR"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!labels.length}
              className="rounded-xl border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-100"
            >
              Cetak Stiker
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 print:border-0 print:bg-transparent print:p-0">
        <h2 className="text-sm font-medium text-white mb-3 print:hidden">Preview stiker</h2>
        <QrPrintGrid
          labels={labels}
          images={images}
          printRootClass="qr-print-create-root"
          emptyMessage="Belum ada data QR. Generate dulu untuk lihat preview."
        />
      </div>
    </div>
  );
}
