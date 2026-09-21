"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteLoanAction } from "../actions";

export function DeleteLoanButton({
  loanId,
  borrowerName,
}: {
  loanId: string;
  borrowerName: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Hapus Peminjaman
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Hapus Peminjaman?</h3>
                <p className="text-xs text-zinc-400">Peminjam: {borrowerName}</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300">
              Data peminjaman ini akan dihapus secara permanen. Jika barang dalam status sedang dipinjam, unit akan otomatis dikembalikan ke status tersedia.
            </p>

            <form action={deleteLoanAction} className="flex gap-2 justify-end pt-2">
              <input type="hidden" name="loanId" value={loanId} />
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Ya, Hapus Peminjaman
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
