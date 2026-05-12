"use client";

import { useMemo, useState } from "react";
import { approveLoanAction } from "../actions";

type ItemRow = {
  loanItemId: string;
  itemName: string;
  qrCode: string;
  condition: string;
};

export function DocumentEditor({
  loanId,
  borrowerName,
  adminDefaultName,
  initialItems,
}: {
  loanId: string;
  borrowerName: string;
  adminDefaultName: string;
  initialItems: ItemRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const defaultLetterNo = useMemo(() => {
    const year = new Date().getFullYear();
    return `SAR/INV/${year}/001`;
  }, []);

  const orderedIds = items.map((item) => item.loanItemId).join(",");

  return (
    <form action={approveLoanAction} className="space-y-4">
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="orderedLoanItemIds" value={orderedIds} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Nomor surat</label>
          <input
            name="letterNumber"
            defaultValue={defaultLetterNo}
            required
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Tanggal surat</label>
          <input
            defaultValue={today}
            disabled
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">
          Isi/ketentuan surat
        </label>
        <textarea
          name="letterBody"
          defaultValue="Barang dipinjam untuk keperluan operasional SAR dan wajib dikembalikan dalam kondisi baik."
          className="w-full min-h-24 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Tanda tangan peminjam
          </label>
          <input
            name="borrowerSignerName"
            defaultValue={borrowerName}
            required
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            Tanda tangan admin
          </label>
          <input
            name="adminSignerName"
            defaultValue={adminDefaultName}
            required
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 p-3">
        <p className="text-sm font-medium text-zinc-200 mb-2">
          Daftar barang di dokumen (drag untuk urutkan)
        </p>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.loanItemId}
              draggable
              onDragStart={() => setDraggingId(item.loanItemId)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (!draggingId || draggingId === item.loanItemId) return;
                const next = [...items];
                const from = next.findIndex((x) => x.loanItemId === draggingId);
                const to = next.findIndex((x) => x.loanItemId === item.loanItemId);
                if (from < 0 || to < 0) return;
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                setItems(next);
                setDraggingId(null);
              }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 cursor-move"
            >
              <p className="text-sm text-zinc-100">{item.itemName}</p>
              <p className="text-xs text-zinc-400">
                {item.qrCode} · kondisi saat pinjam: {item.condition}
              </p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
      >
        Approve + Simpan Dokumen
      </button>
    </form>
  );
}

