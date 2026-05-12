"use client";

import { createLoanRequestAction } from "./actions";

type UnitOption = {
  id: string;
  qrCode: string;
  condition: string;
  itemName: string;
  categoryName: string | null;
};

export function PinjamForm({
  units,
  successRef,
  errorMessage,
}: {
  units: UnitOption[];
  successRef?: string;
  errorMessage?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Form Peminjaman</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Isi data peminjam dan pilih unit barang yang ingin dipinjam.
        </p>
      </div>

      {successRef ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Request berhasil dikirim. Nomor referensi: <strong>{successRef}</strong>
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      ) : null}

      <form action={createLoanRequestAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="borrowerName"
            required
            placeholder="Nama lengkap"
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            name="borrowerDivision"
            required
            placeholder="Divisi / Satuan"
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            name="borrowDate"
            required
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            name="expectedReturnDate"
            required
            className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>

        <textarea
          name="purpose"
          required
          placeholder="Keperluan peminjaman"
          className="w-full min-h-24 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
        />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2 max-h-96 overflow-auto">
          <p className="text-sm text-zinc-300 font-medium">
            Pilih barang tersedia
          </p>
          {units.map((unit) => (
            <label
              key={unit.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 cursor-pointer hover:bg-zinc-800/40"
            >
              <input type="checkbox" name="itemUnitId" value={unit.id} />
              <div className="text-sm">
                <p className="text-zinc-100">{unit.itemName}</p>
                <p className="text-xs text-zinc-400">
                  {unit.qrCode} · {unit.categoryName ?? "-"} · {unit.condition}
                </p>
              </div>
            </label>
          ))}
          {units.length === 0 ? (
            <p className="text-sm text-zinc-500">Tidak ada barang tersedia.</p>
          ) : null}
        </div>

        <button
          type="submit"
          className="rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
        >
          Kirim Request Peminjaman
        </button>
      </form>
    </div>
  );
}

