"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import {
  Camera,
  CameraOff,
  X,
  Plus,
  Search,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: "ok" | "warn";
    msg: string;
  } | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const recentScanRef = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  // auto-clear feedback after 2s
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  function addByQrCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    // debounce same-code scans within 1.5s (camera fires continuously)
    const now = Date.now();
    if (
      recentScanRef.current &&
      recentScanRef.current.code === trimmed &&
      now - recentScanRef.current.at < 1500
    ) {
      return;
    }
    recentScanRef.current = { code: trimmed, at: now };

    const unit = units.find((u) => u.qrCode === trimmed);
    if (!unit) {
      setScanFeedback({
        type: "warn",
        msg: `${trimmed} tidak ditemukan di daftar tersedia.`,
      });
      return;
    }
    if (selected.has(unit.id)) {
      setScanFeedback({
        type: "warn",
        msg: `${unit.itemName} (${unit.qrCode}) sudah dipilih.`,
      });
      return;
    }
    setSelected((prev) => new Set(prev).add(unit.id));
    setScanFeedback({
      type: "ok",
      msg: `Ditambahkan: ${unit.itemName} (${unit.qrCode})`,
    });
  }

  function removeSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function startScan() {
    setScanError(null);
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      // Prefer rear camera on phones; fall back to any available device.
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current!,
        (result) => {
          if (!result) return;
          addByQrCode(result.getText());
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error(e);
      setScanError(
        "Tidak bisa mengakses kamera. Cek izin browser, dan pastikan halaman dibuka via HTTPS."
      );
      setScanning(false);
    }
  }

  function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  function addUnit(unit: UnitOption) {
    if (selected.has(unit.id)) {
      setScanFeedback({
        type: "warn",
        msg: `${unit.itemName} (${unit.qrCode}) sudah dipilih.`,
      });
      return;
    }
    setSelected((prev) => new Set(prev).add(unit.id));
    setScanFeedback({
      type: "ok",
      msg: `Ditambahkan: ${unit.itemName} (${unit.qrCode})`,
    });
    setManualQuery("");
    setManualOpen(false);
  }

  const selectedUnits = units.filter((u) => selected.has(u.id));
  const availableUnits = units.filter((u) => !selected.has(u.id));
  const matchingUnits = (() => {
    const q = manualQuery.trim().toLowerCase();
    const list = q
      ? availableUnits.filter(
          (u) =>
            u.itemName.toLowerCase().includes(q) ||
            u.qrCode.toLowerCase().includes(q) ||
            (u.categoryName ?? "").toLowerCase().includes(q)
        )
      : availableUnits;
    return list.slice(0, 30);
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-semibold text-white">
          Form Peminjaman
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          Isi data peminjam, lalu scan QR setiap barang yang ingin dipinjam.
        </p>
      </div>

      {successRef ? (
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-3 space-y-2">
          <p className="text-sm text-emerald-300">
            Request berhasil dikirim. Nomor referensi:{" "}
            <strong className="font-mono">{successRef}</strong>
          </p>
          <p className="text-xs text-emerald-200/80">
            Berikut draft surat peminjaman. Setelah disetujui admin, surat resmi
            (tanpa watermark DRAFT) akan diberikan.
          </p>
          <a
            href={`/api/loans/${successRef}/pdf?draft=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
          >
            <FileText className="w-3.5 h-3.5" />
            Lihat / Unduh Draft Surat
          </a>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      ) : null}

      <form action={createLoanRequestAction} className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
          <label className="text-xs text-zinc-400 space-y-1">
            Tanggal pinjam
            <input
              type="date"
              name="borrowDate"
              required
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-zinc-400 space-y-1">
            Rencana kembali
            <input
              type="date"
              name="expectedReturnDate"
              required
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <textarea
          name="purpose"
          required
          placeholder="Keperluan peminjaman"
          className="w-full min-h-24 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
        />

        {/* Scanner panel */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Scan QR Barang</p>
              <p className="text-xs text-zinc-400">
                Scan setiap unit yang ingin dipinjam, atau ketik kode manual.
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200">
              {selected.size} dipilih
            </span>
          </div>

          <div className="bg-black aspect-square sm:aspect-video relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            {!scanning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-center px-4">
                <Camera className="w-8 h-8 text-orange-400" />
                <p className="text-xs text-zinc-200">
                  Tekan tombol untuk mulai scan
                </p>
              </div>
            ) : (
              <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-24 sm:h-32 border-2 border-orange-500/70 rounded-xl pointer-events-none" />
            )}
          </div>

          <div className="p-3 space-y-2">
            <div className="flex gap-2">
              {!scanning ? (
                <button
                  type="button"
                  onClick={startScan}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-medium text-white"
                >
                  <Camera className="w-4 h-4" /> Mulai Scan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScan}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100"
                >
                  <CameraOff className="w-4 h-4" /> Berhenti
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-zinc-400">
                Atau ketik / pilih barang manual:
              </p>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                <input
                  value={manualQuery}
                  onChange={(e) => {
                    setManualQuery(e.target.value);
                    setManualOpen(true);
                  }}
                  onFocus={() => setManualOpen(true)}
                  onBlur={() =>
                    // delay so click on list item still fires
                    setTimeout(() => setManualOpen(false), 150)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matchingUnits.length > 0) {
                      e.preventDefault();
                      addUnit(matchingUnits[0]);
                    } else if (e.key === "Escape") {
                      setManualOpen(false);
                    }
                  }}
                  placeholder="Cari nama barang, kode QR, atau kategori..."
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-2 text-sm text-white"
                />

                {manualOpen ? (
                  <div className="absolute z-20 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl">
                    {matchingUnits.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-zinc-500 text-center">
                        {availableUnits.length === 0
                          ? "Semua barang sudah dipilih."
                          : "Tidak ada hasil."}
                      </p>
                    ) : (
                      <ul className="py-1">
                        {matchingUnits.map((unit) => (
                          <li key={unit.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => addUnit(unit)}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-800 flex items-center gap-2"
                            >
                              <Plus className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-100 truncate">
                                  {unit.itemName}
                                </p>
                                <p className="text-[11px] text-zinc-500 font-mono truncate">
                                  {unit.qrCode} · {unit.categoryName ?? "-"} ·{" "}
                                  {unit.condition}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="text-[10px] text-zinc-500">
                Tekan Enter untuk pilih hasil teratas.
              </p>
            </div>

            {scanFeedback ? (
              <p
                className={`text-xs rounded-lg px-3 py-2 ${
                  scanFeedback.type === "ok"
                    ? "bg-emerald-950/40 border border-emerald-900/40 text-emerald-300"
                    : "bg-amber-950/40 border border-amber-900/40 text-amber-300"
                }`}
              >
                {scanFeedback.type === "ok" ? (
                  <Check className="inline w-3 h-3 mr-1" />
                ) : (
                  <AlertTriangle className="inline w-3 h-3 mr-1" />
                )}
                {scanFeedback.msg}
              </p>
            ) : null}

            {scanError ? (
              <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
                {scanError}
              </p>
            ) : null}
          </div>
        </div>

        {/* Selected items list */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Barang yang Dipinjam</p>
            <span className="text-xs text-zinc-400">
              {selected.size} barang
            </span>
          </div>
          {selectedUnits.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Belum ada barang. Scan QR atau ketik kode di atas.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {selectedUnits.map((unit) => (
                <li
                  key={unit.id}
                  className="px-4 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100 truncate">
                      {unit.itemName}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono truncate">
                      {unit.qrCode} · {unit.categoryName ?? "-"} · {unit.condition}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelected(unit.id)}
                    className="text-red-300 hover:text-red-200 p-1.5"
                    title="Hapus"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {/* hidden form input so server action receives the id */}
                  <input type="hidden" name="itemUnitId" value={unit.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={selected.size === 0}
          className="rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white"
        >
          Kirim Request Peminjaman ({selected.size})
        </button>
      </form>
    </div>
  );
}
