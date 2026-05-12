"use client";

import { useState } from "react";
import { Camera, X } from "lucide-react";

type ItemRow = {
  itemUnitId: string;
  itemName: string;
  qrCode: string;
  conditionAtBorrow: string;
};

type ReturnFormProps = {
  loanId: string;
  items: ItemRow[];
  action: (formData: FormData) => void;
};

export function ReturnForm({ loanId, items, action }: ReturnFormProps) {
  const [conditions, setConditions] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.itemUnitId, "good"]))
  );
  const [previews, setPreviews] = useState<Record<string, string[]>>({});

  function handleFiles(itemUnitId: string, files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setPreviews((prev) => ({ ...prev, [itemUnitId]: urls }));
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="loanId" value={loanId} />

      {items.map((li) => {
        const condition = conditions[li.itemUnitId];
        const needsDetails = condition === "damaged" || condition === "lost";
        const itemPreviews = previews[li.itemUnitId] ?? [];

        return (
          <div
            key={li.itemUnitId}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">{li.itemName}</p>
                <p className="text-xs text-zinc-400 font-mono">{li.qrCode}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                pinjam: {li.conditionAtBorrow}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-zinc-400 space-y-1">
                Kondisi saat kembali
                <select
                  name={`condition_${li.itemUnitId}`}
                  value={condition}
                  onChange={(e) =>
                    setConditions((prev) => ({
                      ...prev,
                      [li.itemUnitId]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white"
                >
                  <option value="good">Baik</option>
                  <option value="damaged">Rusak</option>
                  <option value="lost">Hilang</option>
                </select>
              </label>

              <label className="text-xs text-zinc-400 space-y-1">
                Severity
                <select
                  name={`severity_${li.itemUnitId}`}
                  defaultValue=""
                  disabled={!needsDetails}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white disabled:opacity-40"
                >
                  <option value="">-</option>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="total_loss">Total loss</option>
                </select>
              </label>

              <label className="text-xs text-zinc-400 space-y-1 sm:col-span-1">
                Deskripsi
                <input
                  name={`description_${li.itemUnitId}`}
                  placeholder={needsDetails ? "Wajib diisi" : "Opsional"}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-2 text-sm text-white"
                />
              </label>
            </div>

            {needsDetails ? (
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 flex items-center gap-2 cursor-pointer">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-zinc-200 hover:border-orange-500/50">
                    <Camera className="w-4 h-4" />
                    Upload foto kondisi (wajib)
                  </span>
                  <input
                    type="file"
                    name={`photos_${li.itemUnitId}`}
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFiles(li.itemUnitId, e.target.files)}
                  />
                </label>
                {itemPreviews.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {itemPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <X className="w-3 h-3" /> Belum ada foto
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      <button
        type="submit"
        className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
      >
        Simpan Pengembalian
      </button>
    </form>
  );
}
