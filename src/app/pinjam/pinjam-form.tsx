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
  PenLine,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { createLoanRequestAction } from "./actions";
import {
  InternalBorrowerField,
  type InternalBorrowerOption,
} from "@/components/internal-borrower-field";
import type { BorrowCatalogItem } from "@/lib/borrow-catalog";
import type { ScanUnitOption } from "@/lib/borrow-catalog";
import { SignaturePad } from "@/components/signature-pad";
import { Modal } from "@/components/modal";
import { formatTanggalID } from "@/lib/format";

type SelectedLine = BorrowCatalogItem & { quantity: number };

export function PinjamForm({
  locationId,
  locationSlug,
  locationName,
  catalog,
  scanUnits,
  internalBorrowers = [],
  successRef,
  errorMessage,
  external = false,
}: {
  locationId: string;
  locationSlug: string;
  locationName: string;
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
  const [borrowDate, setBorrowDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
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

      <form
        ref={formRef}
        action={createLoanRequestAction}
        onSubmit={(e) => {
          if (!isConfirmedSubmit) {
            e.preventDefault();
            if (totalUnits === 0) return;
            setOpenConfirmModal(true);
          }
        }}
        className="space-y-3 sm:space-y-4"
      >
        <input type="hidden" name="locationId" value={locationId} />
        <input type="hidden" name="lokasi" value={locationSlug} />
        <input type="hidden" name="loanType" value={external ? "external" : "internal"} />
        <p className="text-xs text-orange-200/90 rounded-lg border border-orange-900/30 bg-orange-950/20 px-3 py-2">
          Gudang: <strong>{locationName}</strong>
        </p>

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
              value={borrowDate}
              onChange={(e) => {
                const val = e.target.value;
                setBorrowDate(val);
                if (expectedReturnDate && val && expectedReturnDate < val) {
                  setExpectedReturnDate(val);
                }
              }}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-zinc-400 space-y-1">
            Rencana kembali
            <input
              type="date"
              name="expectedReturnDate"
              required
              min={borrowDate}
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
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
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">Pilih Barang yang Dipinjam</p>
              <p className="text-xs text-zinc-400">
                Cari nama barang atau klik Scan QR (+1 unit per scan).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 font-medium">
                {selectedLines.length} jenis · {totalUnits} unit
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {/* Baris Cari Barang + Tombol Scan QR */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
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
                  placeholder="Cari nama, merk, atau kategori barang..."
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />

                {manualOpen ? (
                  <div className="absolute z-50 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
                    {matchingItems.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-zinc-500 text-center">
                        Tidak ada barang tersedia.
                      </p>
                    ) : (
                      <ul className="py-1">
                        {matchingItems.map((item) => {
                          const pickedQty = selected.get(item.itemId)?.quantity ?? 0;
                          return (
                            <li key={item.itemId}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  addOrIncrementItem(item.itemId, 1);
                                  setManualQuery("");
                                  setManualOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-zinc-800 flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Plus className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-zinc-100 truncate">{item.name}</p>
                                    <p className="text-[11px] text-zinc-500">
                                      {item.merk ?? "-"} · {item.categoryName ?? "-"} · stok{" "}
                                      {item.availableCount}
                                    </p>
                                  </div>
                                </div>
                                {pickedQty > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-950/80 text-orange-300 border border-orange-800/60 shrink-0">
                                    Dipilih: {pickedQty}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>

              {!scanning ? (
                <button
                  type="button"
                  onClick={startScan}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 text-xs sm:text-sm font-medium text-white shrink-0 transition-colors"
                  title="Scan QR unit untuk menambah otomatis"
                >
                  <Camera className="w-4 h-4 text-orange-400" />
                  <span>Scan QR</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScan}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-950/70 hover:bg-red-900/70 border border-red-800 px-3 py-2 text-xs sm:text-sm font-medium text-red-200 shrink-0 transition-colors"
                >
                  <CameraOff className="w-4 h-4 text-red-400" />
                  <span>Tutup Scan</span>
                </button>
              )}
            </div>

            {/* Kotak Kamera (hanya tampil saat tombol Scan QR aktif) */}
            <div
              className={
                scanning
                  ? "bg-black h-40 sm:h-44 max-w-xs mx-auto rounded-xl overflow-hidden relative border border-zinc-800"
                  : "sr-only"
              }
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
              />
              {scanning && (
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-orange-500/70 rounded-lg pointer-events-none" />
              )}
            </div>

            {scanError ? (
              <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
                {scanError}
              </p>
            ) : null}

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

            {/* Daftar Barang yang Dipinjam */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
              <div className="px-3.5 py-2 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  Daftar Barang yang Dipinjam
                </span>
                {selectedLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Map())}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Kosongkan Daftar
                  </button>
                )}
              </div>

              {selectedLines.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs sm:text-sm text-zinc-500">
                  Belum ada barang dipilih. Cari nama barang di atas atau gunakan tombol Scan QR.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-800/80">
                  {selectedLines.map((line, idx) => (
                    <li
                      key={line.itemId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          {idx + 1}. {line.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {line.merk ?? "-"} · {line.categoryName ?? "-"} · maks{" "}
                          <strong className="text-zinc-300">{line.availableCount} unit</strong>
                        </p>
                        <input type="hidden" name="borrowItemId" value={line.itemId} />
                        <input type="hidden" name="borrowQuantity" value={line.quantity} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                          className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={line.availableCount}
                          value={line.quantity}
                          onChange={(e) =>
                            setQuantity(line.itemId, Number(e.target.value) || 1)
                          }
                          className="w-12 py-1 text-center rounded-lg bg-zinc-950 border border-zinc-700 text-sm font-semibold text-white"
                        />
                        <button
                          type="button"
                          onClick={() => addOrIncrementItem(line.itemId, 1)}
                          className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.itemId)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Hapus barang"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Tanda tangan peminjam ──────────────────────── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="w-4 h-4 text-orange-400" />
            <p className="text-sm font-medium text-white">Tanda Tangan Peminjam</p>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Tanda tangani formulir sebelum dikirim ke admin.
          </p>
          <SignaturePad
            inputName="borrowerSignatureDataUrl"
            label="Gambar tanda tangan Anda"
          />
        </div>

        <button
          type="submit"
          disabled={totalUnits === 0}
          className="rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Kirim Request ({totalUnits} unit)
        </button>
      </form>

      {/* Modal Konfirmasi Kirim Request Peminjaman (Ya / Tidak) */}
      <Modal
        open={openConfirmModal}
        onClose={() => setOpenConfirmModal(false)}
        title="Konfirmasi Pengajuan Peminjaman"
        titleIcon={<CheckCircle2 className="w-5 h-5 text-orange-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <p className="text-sm text-zinc-200">
            Apakah Anda yakin ingin mengirim pengajuan peminjaman barang ini?
          </p>

          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Gudang:</span>
              <strong className="text-white">{locationName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tanggal Pinjam:</span>
              <span className="text-zinc-200">{formatTanggalID(borrowDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Rencana Kembali:</span>
              <span className="text-zinc-200">{formatTanggalID(expectedReturnDate)}</span>
            </div>
            <div className="pt-1.5 border-t border-zinc-800/80">
              <p className="text-zinc-400 mb-1">
                Daftar Barang ({selectedLines.length} jenis · {totalUnits} unit):
              </p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {selectedLines.map((line, idx) => (
                  <div key={line.itemId} className="flex justify-between text-zinc-200">
                    <span className="truncate">
                      {idx + 1}. {line.name}
                    </span>
                    <strong className="text-orange-400 shrink-0 ml-2">{line.quantity} unit</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setOpenConfirmModal(false)}
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Tidak
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConfirmedSubmit(true);
                setOpenConfirmModal(false);
                setTimeout(() => {
                  formRef.current?.requestSubmit();
                }, 0);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ya, Kirim Request</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
