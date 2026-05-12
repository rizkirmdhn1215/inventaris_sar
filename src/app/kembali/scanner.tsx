"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Check, Loader2, Trash2 } from "lucide-react";

type ScannedItem = {
  qrCode: string;
  itemName: string | null;
  status: string | null;
  found: boolean;
  loanId: string | null;
  borrowerName: string | null;
};

async function lookupQr(qrCode: string): Promise<ScannedItem> {
  try {
    const res = await fetch(`/api/items/by-qr?code=${encodeURIComponent(qrCode)}`);
    if (!res.ok) {
      return {
        qrCode,
        itemName: null,
        status: null,
        found: false,
        loanId: null,
        borrowerName: null,
      };
    }
    const data = await res.json();
    return { qrCode, ...data, found: true };
  } catch {
    return {
      qrCode,
      itemName: null,
      status: null,
      found: false,
      loanId: null,
      borrowerName: null,
    };
  }
}

export function KembaliScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  async function startScan() {
    setError(null);
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        async (result) => {
          if (!result) return;
          const text = result.getText();
          await handleCode(text);
        }
      );
      controlsRef.current = controls;
    } catch (e) {
      console.error(e);
      setError("Tidak bisa mengakses kamera. Cek izin browser.");
      setScanning(false);
    }
  }

  function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function handleCode(qrCode: string) {
    const trimmed = qrCode.trim();
    if (!trimmed) return;
    if (scanned.some((s) => s.qrCode === trimmed)) return; // already in list
    setBusy(true);
    const item = await lookupQr(trimmed);
    setScanned((prev) => {
      if (prev.some((s) => s.qrCode === item.qrCode)) return prev;
      return [...prev, item];
    });
    setBusy(false);
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await handleCode(manualInput);
    setManualInput("");
  }

  function removeScanned(qrCode: string) {
    setScanned((prev) => prev.filter((s) => s.qrCode !== qrCode));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="aspect-square bg-black flex items-center justify-center relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!scanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-center px-4">
              <Camera className="w-10 h-10 text-orange-400" />
              <p className="text-sm text-zinc-200">Tekan tombol untuk mulai scan</p>
            </div>
          ) : (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 border-2 border-orange-500/70 rounded-xl pointer-events-none" />
          )}
        </div>
        <div className="p-3 flex gap-2">
          {!scanning ? (
            <button
              onClick={startScan}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-sm font-medium text-white"
            >
              <Camera className="w-4 h-4" /> Mulai Scan
            </button>
          ) : (
            <button
              onClick={stopScan}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100"
            >
              <CameraOff className="w-4 h-4" /> Berhenti
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleManual}
        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2"
      >
        <p className="text-xs text-zinc-400">Atau ketik manual kode QR</p>
        <div className="flex gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="SAR-CHAINSAW-0001"
            className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-zinc-700 hover:border-zinc-600 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tambah"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">
            Barang Discan
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
            {scanned.length}
          </span>
        </div>
        {scanned.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-500">
            Belum ada barang. Scan atau ketik kode QR.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {scanned.map((item) => (
              <li
                key={item.qrCode}
                className="p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100 truncate">
                    {item.found ? (
                      <>
                        <Check className="inline w-4 h-4 text-emerald-400 mr-1" />
                        {item.itemName ?? item.qrCode}
                      </>
                    ) : (
                      <span className="text-amber-300">
                        {item.qrCode} (tidak ditemukan)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400 font-mono truncate">
                    {item.qrCode}
                    {item.borrowerName ? ` · ${item.borrowerName}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeScanned(item.qrCode)}
                  className="text-red-300 hover:text-red-200 p-1.5"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-3">
        <p className="text-xs text-emerald-200">
          Setelah selesai scan semua barang, serahkan ke petugas gudang untuk
          pemeriksaan kondisi fisik. Petugas akan input kondisi & foto di panel
          admin.
        </p>
      </div>
    </div>
  );
}
