"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import {
  Camera,
  CameraOff,
  X,
  Plus,
  Minus,
  Search,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";
import { createLoanRequestAction } from "./actions";
import {
  InternalBorrowerField,
  type InternalBorrowerOption,
} from "@/components/internal-borrower-field";
import type { BorrowCatalogItem } from "@/lib/borrow-catalog";
import type { ScanUnitOption } from "@/lib/borrow-catalog";

type SelectedLine = BorrowCatalogItem & { quantity: number };

export function PinjamForm({
  catalog,
  scanUnits,
  internalBorrowers = [],
  successRef,
  errorMessage,
  external = false,
}: {
  catalog: BorrowCatalogItem[];
  scanUnits: ScanUnitOption[];
  internalBorrowers?: InternalBorrowerOption[];
  successRef?: string;
  errorMessage?: string;
  external?: boolean;
}) {
  const [selected, setSelected] = useState<Map<string, SelectedLine>>(new Map());
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

  const catalogById = new Map(catalog.map((c) => [c.itemId, c]));

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  function addOrIncrementItem(itemId: string, delta = 1) {
    const item = catalogById.get(itemId);
    if (!item) {
      setScanFeedback({
        type: "warn",
        msg: "Barang tidak tersedia untuk dipinjam (maintenance atau habis).",
      });
      return false;
    }

    const current = selected.get(itemId)?.quantity ?? 0;
    if (current + delta > item.availableCount) {
      setScanFeedback({
        type: "warn",
        msg: `Stok ${item.name} hanya ${item.availableCount} unit tersedia.`,
      });
      return false;
    }

    setSelected((prev) => {
      const next = new Map(prev);
      next.set(itemId, { ...item, quantity: current + delta });
      return next;
    });
    setScanFeedback({
      type: "ok",
      msg: `${item.name} × ${current + delta}`,
    });
    return true;
  }

  function setQuantity(itemId: string, quantity: number) {
    const item = catalogById.get(itemId);
    if (!item) return;
    const q = Math.max(0, Math.min(quantity, item.availableCount));
    setSelected((prev) => {
      const next = new Map(prev);
      if (q === 0) next.delete(itemId);
      else next.set(itemId, { ...item, quantity: q });
      return next;
    });
  }

  function removeLine(itemId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }

  function addByQrCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (
      recentScanRef.current &&
      recentScanRef.current.code === trimmed &&
      now - recentScanRef.current.at < 1500
    ) {
      return;
    }
    recentScanRef.current = { code: trimmed, at: now };

    const unit = scanUnits.find((u) => u.qrCode === trimmed);
    if (!unit) {
      setScanFeedback({
        type: "warn",
        msg: `${trimmed} tidak ditemukan atau tidak tersedia.`,
      });
      return;
    }
    addOrIncrementItem(unit.itemId, 1);
  }

  async function startScan() {
    setScanError(null);
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
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

  const selectedLines = [...selected.values()];
  const totalUnits = selectedLines.reduce((s, l) => s + l.quantity, 0);

  const matchingItems = (() => {
    const q = manualQuery.trim().toLowerCase();
    const list = q
      ? catalog.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.merk ?? "").toLowerCase().includes(q) ||
            (item.categoryName ?? "").toLowerCase().includes(q)
        )
      : catalog;
    return list.slice(0, 30);
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
      <div>
        <h1 className="text-lg sm:text-2xl font-semibold text-white">
          {external ? "Form Peminjaman Eksternal" : "Form Peminjaman"}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          {external
            ? "Untuk peminjam dari instansi lain. Cari jenis barang (mis. Medkit) lalu tentukan jumlah unit."
            : "Cari jenis barang lalu isi jumlah unit. Scan QR opsional (+1 unit per scan)."}
        </p>
      </div>

      {successRef ? (
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-3 space-y-2">
          <p className="text-sm text-emerald-300">
            Request berhasil dikirim. Nomor referensi:{" "}
            <strong className="font-mono">{successRef}</strong>
          </p>
          <p className="text-xs text-emerald-200/80">
            Draft surat menampilkan barang per jenis (bukan per stiker QR).
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
        <input type="hidden" name="loanType" value={external ? "external" : "internal"} />

        {external ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 rounded-xl border border-orange-900/30 bg-orange-950/10 p-3">
            <input
              name="instansi"
              required
              placeholder="Instansi / Lembaga"
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="externalLetterNumber"
              required
              placeholder="No. Surat (mis: 005/SAR-EXT/X/2026)"
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
            />
            <input
              name="contactPerson"
              required
              placeholder="Contact Person"
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <input
              name="contactVia"
              required
              placeholder="Kontak via (HP/WA/Email)"
              className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {external ? (
            <>
              <input
                name="borrowerName"
                required
                placeholder="Nama lengkap penanggung jawab"
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <input
                name="borrowerDivision"
                required
                placeholder="Jabatan / Satuan"
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </>
          ) : (
            <InternalBorrowerField borrowers={internalBorrowers} />
          )}
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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Cari & Pilih Barang</p>
              <p className="text-xs text-zinc-400">
                Satu baris per jenis (Medkit, Tenda, dll.) — tentukan jumlah unit.
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200">
              {totalUnits} unit
            </span>
          </div>

          <div className="p-3 space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                value={manualQuery}
                onChange={(e) => {
                  setManualQuery(e.target.value);
                  setManualOpen(true);
                }}
                onFocus={() => setManualOpen(true)}
                onBlur={() => setTimeout(() => setManualOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matchingItems.length > 0) {
                    e.preventDefault();
                    addOrIncrementItem(matchingItems[0].itemId, 1);
                    setManualQuery("");
                    setManualOpen(false);
                  }
                }}
                placeholder="Cari nama, merk, atau kategori..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-2 text-sm text-white"
              />

              {manualOpen ? (
                <div className="absolute z-50 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl">
                  {matchingItems.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-500 text-center">
                      Tidak ada barang tersedia.
                    </p>
                  ) : (
                    <ul className="py-1">
                      {matchingItems.map((item) => (
                        <li key={item.itemId}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              addOrIncrementItem(item.itemId, 1);
                              setManualQuery("");
                              setManualOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-800 flex items-center gap-2"
                          >
                            <Plus className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-zinc-100 truncate">{item.name}</p>
                              <p className="text-[11px] text-zinc-500">
                                {item.merk ?? "-"} · {item.categoryName ?? "-"} · stok{" "}
                                {item.availableCount}
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
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="overflow-hidden rounded-t-2xl">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Scan QR (opsional)</p>
              <span className="text-[10px] text-zinc-500">+1 unit per scan</span>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                  <Camera className="w-8 h-8 text-orange-400" />
                  <p className="text-xs text-zinc-200">Mulai scan untuk menambah unit</p>
                </div>
              ) : (
                <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 h-24 border-2 border-orange-500/70 rounded-xl pointer-events-none" />
              )}
            </div>
          </div>
          <div className="p-3 flex gap-2">
            {!scanning ? (
              <button
                type="button"
                onClick={startScan}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm text-white"
              >
                <Camera className="w-4 h-4" /> Mulai Scan
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScan}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100"
              >
                <CameraOff className="w-4 h-4" /> Berhenti
              </button>
            )}
          </div>
          {scanError ? (
            <p className="px-3 pb-3 text-xs text-red-300">{scanError}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Barang yang Dipinjam</p>
            <span className="text-xs text-zinc-400">{selectedLines.length} jenis</span>
          </div>
          {selectedLines.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Belum ada barang. Cari nama barang di atas.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {selectedLines.map((line) => (
                <li
                  key={line.itemId}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-100">{line.name}</p>
                    <p className="text-xs text-zinc-500">
                      {line.merk ?? "-"} · max {line.availableCount}
                    </p>
                    <input type="hidden" name="borrowItemId" value={line.itemId} />
                    <input type="hidden" name="borrowQuantity" value={line.quantity} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                      className="p-1.5 rounded-lg border border-zinc-700 text-zinc-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={line.availableCount}
                      value={line.quantity}
                      onChange={(e) =>
                        setQuantity(line.itemId, Number(e.target.value) || 1)
                      }
                      className="w-12 text-center rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => addOrIncrementItem(line.itemId, 1)}
                      className="p-1.5 rounded-lg border border-zinc-700 text-zinc-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.itemId)}
                      className="p-1.5 text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={totalUnits === 0}
          className="rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white"
        >
          Kirim Request ({totalUnits} unit)
        </button>
      </form>
    </div>
  );
}
