"use client";

import { useState, useTransition } from "react";
import { Eye, Pencil, Loader2, Save, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Modal } from "@/components/modal";
import { updateUnitDetailsAction } from "./actions";
import { formatTanggalID, STATUS_COLOR } from "@/lib/format";

export type UnitDetailData = {
  id: string;
  qrCode: string;
  status: string;
  condition: string;
  notes: string | null;
  itemName: string;
  categoryName?: string | null;
  merk?: string | null;
  latestReport?: {
    conditionResult: string;
    damageDescription: string | null;
    severity: string | null;
    photoUrls: string[];
    createdAt: Date | string;
    checkedBy?: string | null;
    borrowerName?: string | null;
    purpose?: string | null;
  } | null;
};

/** Saring metadata sistem JSON (seperti qrImagePath) agar tidak muncul di catatan */
export function getCleanNotes(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str) return null;
  if (str.startsWith("{") && str.includes("qrImagePath")) {
    return null;
  }
  return str;
}

/** Dialog 1: Khusus Lihat Saja (Read-Only) */
export function UnitViewDialog({ unit, onClose }: { unit: UnitDetailData; onClose: () => void }) {
  const cleanNotes = getCleanNotes(unit.notes);

  const isProblematic =
    unit.status === "maintenance" ||
    unit.status === "damaged" ||
    unit.status === "lost" ||
    unit.condition === "damaged" ||
    unit.condition === "lost" ||
    Boolean(cleanNotes) ||
    Boolean(unit.latestReport);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Detail Kondisi Unit"
      titleIcon={
        isProblematic ? (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        ) : (
          <Info className="w-4 h-4 text-orange-400" />
        )
      }
    >
      <div className="p-4 space-y-4 text-xs">
        {/* Identitas Unit */}
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white text-sm">{unit.itemName}</span>
            <span className="font-mono text-zinc-400 text-[11px]">{unit.qrCode}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-zinc-400">
              Kategori: <strong className="text-zinc-200">{unit.categoryName ?? "-"}</strong>
            </span>
            {unit.merk && (
              <span className="text-zinc-400">
                Merk: <strong className="text-zinc-200">{unit.merk}</strong>
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                STATUS_COLOR[unit.status] ?? "bg-zinc-800 text-zinc-300"
              }`}
            >
              Status: {unit.status}
            </span>
            <span className="text-zinc-400">
              Kondisi: <strong className="text-zinc-200">{unit.condition}</strong>
            </span>
          </div>
        </div>

        {/* Laporan Kerusakan Terakhir dari Form Pengembalian */}
        {unit.latestReport ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Laporan Pengembalian ({unit.latestReport.conditionResult})
              </span>
              {unit.latestReport.severity && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-900/60 text-red-200 border border-red-800">
                  Tingkat: {unit.latestReport.severity}
                </span>
              )}
            </div>

            {unit.latestReport.damageDescription && (
              <div className="space-y-1">
                <p className="text-[11px] text-zinc-400">Deskripsi saat dikembalikan:</p>
                <p className="rounded-lg bg-zinc-900/80 p-2 text-zinc-200 border border-zinc-800 leading-relaxed whitespace-pre-wrap">
                  {unit.latestReport.damageDescription}
                </p>
              </div>
            )}

            <div className="text-[11px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-zinc-800/60">
              {unit.latestReport.borrowerName && (
                <span>
                  Peminjam: <strong className="text-zinc-300">{unit.latestReport.borrowerName}</strong>
                </span>
              )}
              {unit.latestReport.checkedBy && (
                <span>
                  Dicek oleh: <strong className="text-zinc-300">{unit.latestReport.checkedBy}</strong>
                </span>
              )}
              <span>{formatTanggalID(unit.latestReport.createdAt)}</span>
            </div>

            {unit.latestReport.photoUrls && unit.latestReport.photoUrls.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[11px] text-zinc-400">Foto Bukti Kerusakan:</p>
                <div className="grid grid-cols-2 gap-2">
                  {unit.latestReport.photoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block aspect-video rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Bukti kerusakan ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Catatan Tambahan / Penanganan Saat Ini */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1">
          <p className="text-[11px] font-medium text-zinc-300">Catatan Penanganan / Keterangan:</p>
          <p className="text-zinc-300 text-xs whitespace-pre-wrap">
            {cleanNotes ? cleanNotes : <span className="text-zinc-500 italic">Belum ada catatan.</span>}
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Modal 1: Khusus Lihat Saja (Read-Only) Wrapper dengan tombol */
export function UnitViewModal({ unit }: { unit: UnitDetailData }) {
  const [open, setOpen] = useState(false);
  const cleanNotes = getCleanNotes(unit.notes);

  const isProblematic =
    unit.status === "maintenance" ||
    unit.status === "damaged" ||
    unit.status === "lost" ||
    unit.condition === "damaged" ||
    unit.condition === "lost" ||
    Boolean(cleanNotes) ||
    Boolean(unit.latestReport);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`p-1.5 rounded-lg border transition-colors ${
          isProblematic
            ? "border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60"
            : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
        }`}
        title="Lihat Detail Unit"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>

      {open && <UnitViewDialog unit={unit} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Dialog 2: Khusus Edit Kondisi & Catatan */
export function UnitEditDialog({ unit, onClose }: { unit: UnitDetailData; onClose: () => void }) {
  const [notes, setNotes] = useState(() => getCleanNotes(unit.notes) ?? "");
  const [condition, setCondition] = useState(
    unit.status === "maintenance" ? "maintenance" : unit.condition
  );
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "err"; msg: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const fd = new FormData();
    fd.set("unitId", unit.id);
    fd.set("condition", condition);
    fd.set("notes", notes);

    startTransition(async () => {
      const res = await updateUnitDetailsAction(fd);
      if (res?.error) {
        setStatusMessage({ type: "err", msg: res.error });
      } else {
        setStatusMessage({ type: "ok", msg: res.success ?? "Perubahan berhasil disimpan." });
        setTimeout(() => {
          onClose();
          setStatusMessage(null);
        }, 600);
      }
    });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Edit Kondisi & Catatan Unit"
      titleIcon={<Pencil className="w-4 h-4 text-orange-400" />}
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
        {/* Info ringkas */}
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1">
          <p className="font-semibold text-white text-sm">{unit.itemName}</p>
          <p className="font-mono text-zinc-400 text-[11px]">{unit.qrCode}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Ubah Kondisi / Status Unit
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={isPending || unit.status === "borrowed"}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white text-xs focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
            >
              <option value="good">good (Kondisi Baik / Tersedia)</option>
              <option value="maintenance">maintenance (Dalam Perawatan / Bengkel)</option>
              <option value="damaged">damaged (Rusak)</option>
              <option value="lost">lost (Hilang)</option>
            </select>
            {unit.status === "borrowed" && (
              <p className="text-[11px] text-amber-400 mt-1">
                * Unit sedang dipinjam. Status dapat diubah setelah unit dikembalikan.
              </p>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Catatan Penanganan / Keterangan Masalah
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tulis detail kerusakan, lokasi hilang, proses servis bengkel, atau spare part yang dipesan..."
              disabled={isPending}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white text-xs focus:ring-1 focus:ring-orange-500 disabled:opacity-50 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {statusMessage && (
          <p
            className={`p-2.5 rounded-lg border text-xs ${
              statusMessage.type === "ok"
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                : "bg-red-950/40 border-red-800 text-red-300"
            }`}
          >
            {statusMessage.msg}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Modal 2: Khusus Edit Kondisi & Catatan Wrapper dengan tombol */
export function UnitEditModal({ unit }: { unit: UnitDetailData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        title="Edit Kondisi & Catatan Unit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && <UnitEditDialog unit={unit} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Default export compatibility */
export const UnitDetailModal = UnitViewModal;

