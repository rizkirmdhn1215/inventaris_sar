"use client";

import { useMemo, useState } from "react";
import { approveLoanAction, denyLoanAction } from "../actions";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";
import { SignaturePad } from "@/components/signature-pad";
import { XCircle } from "lucide-react";

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
  adminDefaultNip,
  defaultLetterNumber,
  initialItems,
  borrowerSignatureDataUrl,
  borrowerSignatureScale,
}: {
  loanId: string;
  borrowerName: string;
  adminDefaultName: string;
  adminDefaultNip?: string | null;
  defaultLetterNumber?: string;
  initialItems: ItemRow[];
  borrowerSignatureDataUrl?: string | null;
  borrowerSignatureScale?: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showDenyConfirm, setShowDenyConfirm] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const defaultLetterNo = useMemo(() => {
    if (defaultLetterNumber) return defaultLetterNumber;
    const year = new Date().getFullYear();
    return `SAR/INV/${year}/001`;
  }, [defaultLetterNumber]);

  const orderedIds = items.map((item) => item.loanItemId).join(",");

  return (
    <>
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
          <label className="block text-xs text-zinc-400 mb-1">Isi/ketentuan surat</label>
          <textarea
            name="letterBody"
            defaultValue="Barang dipinjam untuk keperluan operasional SAR dan wajib dikembalikan dalam kondisi baik."
            className="w-full min-h-24 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>

        {/* ── Peminjam ─────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 p-3 space-y-3">
          <p className="text-xs font-medium text-orange-300/90">Peminjam</p>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nama peminjam</label>
            <input
              name="borrowerSignerName"
              defaultValue={borrowerName}
              required
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          {/* Borrower signature from loan form (read-only preview) */}
          {borrowerSignatureDataUrl ? (
            <div className="space-y-1">
              <p className="text-xs text-zinc-400">Tanda tangan peminjam (dari formulir)</p>
              <div className="bg-white rounded-lg p-3 flex items-center justify-center min-h-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={borrowerSignatureDataUrl}
                  alt="Tanda tangan peminjam"
                  style={{
                    maxHeight: 60,
                    width: "auto",
                    transform: `scale(${(borrowerSignatureScale ?? 100) / 100})`,
                    transformOrigin: "center",
                  }}
                />
              </div>
              <input type="hidden" name="borrowerSignatureDataUrl" value={borrowerSignatureDataUrl} />
              <input type="hidden" name="borrowerSignatureDataUrlScale" value={String(borrowerSignatureScale ?? 100)} />
            </div>
          ) : (
            <SignaturePad
              inputName="borrowerSignatureDataUrl"
              label="Tanda tangan peminjam (belum ada — gambar manual)"
            />
          )}
        </div>

        {/* ── Petugas Gudang ───────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 p-3 space-y-3">
          <p className="text-xs font-medium text-orange-300/90">Petugas Gudang</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nama</label>
              <input
                name="adminSignerName"
                defaultValue={adminDefaultName}
                required
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">NIP</label>
              <input
                name="adminSignerNip"
                defaultValue={adminDefaultNip ?? ""}
                placeholder="Contoh: 199001012020121001"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>
          <SignaturePad
            inputName="adminSignatureDataUrl"
            label="Tanda tangan Petugas Gudang (opsional)"
          />
        </div>

        {/* ── Pengawas Gudang ──────────────────────────────── */}
        <div className="rounded-xl border border-zinc-800 p-3 space-y-3">
          <p className="text-xs font-medium text-orange-300/90">Pengawas Gudang</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nama</label>
              <input
                name="pengawasGudangName"
                defaultValue={DEFAULT_PENGAWAS_GUDANG.name}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">NIP</label>
              <input
                name="pengawasGudangNip"
                defaultValue={DEFAULT_PENGAWAS_GUDANG.nip}
                placeholder="NIP pengawas gudang"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>
          <SignaturePad
            inputName="pengawasSignatureDataUrl"
            label="Tanda tangan Pengawas Gudang (opsional)"
          />
        </div>

        {/* ── Daftar barang ────────────────────────────────── */}
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

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
          >
            Approve + Simpan Dokumen
          </button>
          <button
            type="button"
            onClick={() => setShowDenyConfirm(true)}
            className="rounded-xl bg-red-600/80 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white inline-flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4" /> Tolak Peminjaman
          </button>
        </div>
      </form>

      {/* ── Deny confirmation modal ──────────────────────── */}
      {showDenyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Tolak Peminjaman?</h3>
            <p className="text-sm text-zinc-400">
              Peminjaman akan ditolak dan barang yang sudah dialokasikan akan dikembalikan ke gudang.
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <form action={denyLoanAction} className="flex gap-2 justify-end">
              <input type="hidden" name="loanId" value={loanId} />
              <button
                type="button"
                onClick={() => setShowDenyConfirm(false)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-medium text-white"
              >
                Ya, Tolak
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
