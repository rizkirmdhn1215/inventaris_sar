"use client";

import { useActionState, useEffect, useState } from "react";
import { generateQrAction } from "./actions";
import QRCode from "qrcode";
import { AppBrand } from "@/components/app-logo";

type Category = { id: string; name: string };
type QrRenderMap = Record<string, string>;

export function QrGeneratorClient({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(generateQrAction, null);
  const [images, setImages] = useState<QrRenderMap>({});
  const [rows, setRows] = useState([{ id: 1 }]);

  useEffect(() => {
    const run = async () => {
      if (!state?.generated?.length) return;

      const entries = await Promise.all(
        state.generated.map(async (entry) => {
          const dataUrl = await QRCode.toDataURL(entry.qrCode, { width: 150 });
          return [entry.qrCode, dataUrl] as const;
        })
      );

      setImages(Object.fromEntries(entries));
    };

    run();
  }, [state?.generated]);

  return (
    <div className="space-y-6">
      <AppBrand
        size="md"
        title="QR Generator"
        subtitle="Minang Rescue · KPP Padang"
      />
      <p className="text-sm text-zinc-400 -mt-2">
        Isi per baris: nama barang, kategori, jumlah unit.
      </p>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 print:hidden">
        <form action={formAction} className="space-y-4">
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
              disabled={!state?.generated?.length}
              className="rounded-xl border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-100"
            >
              Print Stiker
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 print:border-0 print:bg-transparent print:p-0">
        <h2 className="text-sm font-medium text-white mb-3 print:hidden">Preview stiker</h2>

        {!state?.generated?.length ? (
          <p className="text-sm text-zinc-400 print:hidden">
            Belum ada data QR. Generate dulu untuk lihat preview.
          </p>
        ) : (
          <div className="qr-print-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 print:gap-1">
            {state.generated.map((entry) => (
              <div
                key={entry.qrCode}
                className="print-label border border-zinc-300 rounded-xl bg-white text-black p-2 text-center"
              >
                {images[entry.qrCode] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[entry.qrCode]}
                    alt={entry.qrCode}
                    className="mx-auto w-[120px] h-[120px] print:w-[95px] print:h-[95px]"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] print:w-[95px] print:h-[95px] mx-auto bg-zinc-200" />
                )}
                <p className="text-[11px] print:text-[10px] mt-1 font-semibold truncate">
                  {entry.itemName}
                </p>
                <p className="text-[10px] print:text-[9px] font-mono">{entry.qrCode}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * { visibility: hidden !important; }
          .qr-print-grid, .qr-print-grid * { visibility: visible !important; }
          .qr-print-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            align-content: flex-start !important;
            gap: 4mm !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
          }
          .print-label {
            box-sizing: border-box !important;
            width: 45mm !important;
            height: 55mm !important;
            padding: 2mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-label img {
            width: 30mm !important;
            height: 30mm !important;
          }
        }
      `}</style>
    </div>
  );
}
