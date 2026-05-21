"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type InternalBorrowerOption = {
  id: string;
  nip: string | null;
  name: string;
  pangkat: string | null;
  jabatan: string;
};

export function InternalBorrowerField({
  borrowers,
}: {
  borrowers: InternalBorrowerOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [borrowerId, setBorrowerId] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? borrowers.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.nip ?? "").includes(q) ||
            b.jabatan.toLowerCase().includes(q) ||
            (b.pangkat ?? "").toLowerCase().includes(q)
        )
      : [...borrowers].sort((a, b) => a.name.localeCompare(b.name, "id"));
    return list.slice(0, 20);
  }, [borrowers, query]);

  function selectBorrower(b: InternalBorrowerOption) {
    setBorrowerId(b.id);
    setName(b.name);
    setDivision(b.jabatan);
    setQuery(b.name);
    setOpen(false);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setName(value);
    setBorrowerId("");
    setOpen(true);
  }

  return (
    <div className="sm:col-span-2 space-y-2">
      <input type="hidden" name="internalBorrowerId" value={borrowerId} />
      <input type="hidden" name="borrowerName" value={name} />
      <input type="hidden" name="borrowerDivision" value={division} />

      <label className="block text-xs text-zinc-400 space-y-1">
        Peminjam (Tim SAR — daftar sama di semua lokasi)
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            required
            placeholder="Ketik nama atau NIP…"
            autoComplete="off"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-8 pr-3 py-2 text-sm text-white"
          />
          {open ? (
            <div className="absolute z-50 mt-1 left-0 right-0 max-h-60 overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl">
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-500 text-center">
                  Tidak ada di daftar — isi jabatan di bawah. Nama akan
                  disimpan untuk peminjaman berikutnya.
                </p>
              ) : (
                <ul className="py-1">
                  {matches.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectBorrower(b)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-800"
                      >
                        <p className="text-sm text-zinc-100">{b.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {b.nip ? `${b.nip} · ` : ""}
                          {b.pangkat ? `${b.pangkat} · ` : ""}
                          {b.jabatan}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </label>

      <label className="block text-xs text-zinc-400 space-y-1">
        Jabatan / Satuan
        <input
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setBorrowerId("");
          }}
          required
          placeholder="Jabatan atau satuan kerja"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
        />
      </label>

      {!borrowerId && name.trim() ? (
        <p className="text-[11px] text-zinc-500">
          Peminjam baru akan ditambahkan ke daftar setelah request dikirim.
        </p>
      ) : null}
    </div>
  );
}
