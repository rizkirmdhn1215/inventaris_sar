"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  QrCode,
} from "lucide-react";
import {
  submitBarangKeluarAction,
  updateBarangKeluarLogAction,
  deleteBarangKeluarLogAction,
} from "./actions";
import { Modal } from "@/components/modal";
import { formatTanggalID } from "@/lib/format";
import { printInventoryReport, exportInventoryToCsv } from "@/lib/inventory-report-print";

export type MasterItemWithUnits = {
  id: string;
  name: string;
  categoryName: string | null;
  merk: string | null;
  units: { id: string; qrCode: string; status: string; condition: string }[];
};

export type CategoryOption = {
  id: string;
  name: string;
};

export type OutLog = {
  id: string;
  displayId?: string;
  date: string;
  noRef: string;
  itemName: string;
  category: string;
  qty: number;
  qrCodes: string[];
  reason: string;
  recipient: string;
  target: string;
  notes?: string;
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function BarangKeluarClient({
  locationId,
  locationSlug,
  locationName,
  items: initialItems,
  categories,
  initialLogs,
}: {
  locationId: string;
  locationSlug: string;
  locationName: string;
  items: MasterItemWithUnits[];
  categories: CategoryOption[];
  initialLogs: OutLog[];
}) {
  const [items, setItems] = useState<MasterItemWithUnits[]>(initialItems);
  const [logs, setLogs] = useState<OutLog[]>(initialLogs);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedItemId, setSelectedItemId] = useState(initialItems[0]?.id ?? "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(categories[0]?.id ?? "");
  const [newQty, setNewQty] = useState(1);
  const [outDate, setOutDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [reason, setReason] = useState("Afkir / Rusak Berat");
  const [recipient, setRecipient] = useState("");
  const [target, setTarget] = useState("");
  const [noRef, setNoRef] = useState("");
  const [notes, setNotes] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // State edit log
  const [editingLog, setEditingLog] = useState<OutLog | null>(null);
  const [viewingQrLog, setViewingQrLog] = useState<OutLog | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editRecipient, setEditRecipient] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editNoRef, setEditNoRef] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, startUpdating] = useTransition();

  const availableYears = useMemo(() => {
    const setYears = new Set<number>();
    setYears.add(new Date().getFullYear());
    logs.forEach((log) => {
      const y = new Date(log.date).getFullYear();
      if (!Number.isNaN(y)) setYears.add(y);
    });
    return Array.from(setYears).sort((a, b) => b - a);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const d = new Date(log.date);
      const logYear = d.getFullYear();
      const logMonth = d.getMonth() + 1;
      if (filterYear !== "all" && logYear !== Number(filterYear)) return false;
      if (filterMonth !== "all" && logMonth !== Number(filterMonth)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          log.itemName.toLowerCase().includes(q) ||
          log.category.toLowerCase().includes(q) ||
          log.noRef.toLowerCase().includes(q) ||
          log.reason.toLowerCase().includes(q) ||
          log.recipient.toLowerCase().includes(q) ||
          log.target.toLowerCase().includes(q) ||
          (log.notes?.toLowerCase().includes(q) ?? false) ||
          log.qrCodes.some((qr) => qr.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [logs, filterYear, filterMonth, search]);

  const totalFilteredQty = useMemo(() => {
    return filteredLogs.reduce((sum, item) => sum + item.qty, 0);
  }, [filteredLogs]);

  const activePeriodLabel = useMemo(() => {
    if (filterMonth === "all" && filterYear === "all") return "Semua Periode";
    if (filterMonth !== "all" && filterYear !== "all") {
      return `${MONTH_NAMES[Number(filterMonth) - 1]} ${filterYear}`;
    }
    if (filterMonth !== "all") return `Bulan ${MONTH_NAMES[Number(filterMonth) - 1]}`;
    return `Tahun ${filterYear}`;
  }, [filterMonth, filterYear]);

  function resetFilter() {
    setSearch("");
    setFilterMonth("all");
    setFilterYear("all");
  }

  function handlePrintReport() {
    printInventoryReport({
      title: "SURAT LAPORAN BARANG KELUAR",
      type: "out",
      locationName,
      periodLabel: activePeriodLabel,
      rows: filteredLogs.map((l) => ({
        id: l.id,
        displayId: l.displayId,
        date: l.date,
        noRef: l.noRef,
        itemName: l.itemName,
        category: l.category,
        qty: l.qty,
        sourceOrReason: l.reason,
        recipient: l.recipient,
        target: l.target,
        recipientOrTarget: `${l.recipient}${l.target && l.target !== "-" ? ` → ${l.target}` : ""}`,
        notes: l.notes,
        qrCodes: l.qrCodes,
      })),
      totalQty: totalFilteredQty,
    });
  }

  function handleExportCsv() {
    exportInventoryToCsv({
      filename: `Laporan_Barang_Keluar_${locationSlug}_${activePeriodLabel.replace(/\s+/g, "_")}`,
      type: "out",
      rows: filteredLogs.map((l) => ({
        id: l.id,
        displayId: l.displayId,
        date: l.date,
        noRef: l.noRef,
        itemName: l.itemName,
        category: l.category,
        qty: l.qty,
        sourceOrReason: l.reason,
        recipientOrTarget: `${l.recipient}${l.target && l.target !== "-" ? ` → ${l.target}` : ""}`,
        notes: l.notes,
        qrCodes: l.qrCodes,
      })),
    });
  }

  function openEdit(log: OutLog) {
    setEditingLog(log);
    setEditDate(log.date);
    setEditReason(log.reason);
    setEditRecipient(log.recipient === "-" ? "" : log.recipient);
    setEditTarget(log.target === "-" ? "" : log.target);
    setEditNoRef(log.noRef === "-" ? "" : log.noRef);
    setEditNotes(log.notes || "");
  }

  function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;
    if (!editRecipient.trim()) {
      alert("Nama penerima / PJ wajib diisi.");
      return;
    }

    const fd = new FormData();
    fd.set("id", editingLog.id);
    fd.set("date", editDate);
    fd.set("reason", editReason);
    fd.set("recipient", editRecipient);
    fd.set("target", editTarget);
    fd.set("referenceNo", editNoRef);
    fd.set("notes", editNotes);

    startUpdating(async () => {
      const res = await updateBarangKeluarLogAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      setLogs((prev) =>
        prev.map((l) =>
          l.id === editingLog.id
            ? {
                ...l,
                date: editDate || l.date,
                reason: editReason,
                recipient: editRecipient,
                target: editTarget || "-",
                noRef: editNoRef || "-",
                notes: editNotes,
              }
            : l
        )
      );
      setEditingLog(null);
    });
  }

  function handleDelete(logId: string) {
    if (!window.confirm("Hapus riwayat barang keluar ini dari daftar?")) return;
    const fd = new FormData();
    fd.set("id", logId);

    startUpdating(async () => {
      const res = await deleteBarangKeluarLogAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    });
  }

  const activeItem = items.find((i) => i.id === selectedItemId);
  // Requirement 5: Hanya unit berstatus available
  const availableUnits = activeItem?.units.filter((u) => u.status === "available") ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (mode === "existing" && selectedUnitIds.length === 0) {
      setFeedback({ type: "error", text: "Pilih minimal 1 unit fisik (QR Code) yang dikeluarkan." });
      return;
    }
    if (!recipient.trim()) {
      setFeedback({ type: "error", text: "Nama penerima / penanggung jawab wajib diisi." });
      return;
    }

    const formData = new FormData();
    formData.set("locationId", locationId);
    formData.set("mode", mode);
    formData.set("itemId", selectedItemId);
    formData.set("newItemName", newItemName);
    formData.set("newItemCategory", newItemCategory);
    formData.set("quantity", String(newQty));
    formData.set("date", outDate);
    formData.set("reason", reason);
    formData.set("recipient", recipient);
    formData.set("target", target);
    formData.set("referenceNo", noRef);
    formData.set("notes", notes);
    selectedUnitIds.forEach((uid) => formData.append("unitIds", uid));

    const itemName = mode === "existing"
      ? (activeItem?.name ?? "Barang")
      : newItemName;
    const catName = mode === "existing"
      ? (activeItem?.categoryName ?? "-")
      : (categories.find((c) => c.id === newItemCategory)?.name ?? "-");

    startTransition(async () => {
      const res = await submitBarangKeluarAction(formData);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
        return;
      }

      if (mode === "existing") {
        setItems((prevItems) =>
          prevItems.map((it) => {
            if (it.id !== selectedItemId) return it;
            return {
              ...it,
              units: it.units.map((u) =>
                selectedUnitIds.includes(u.id) ? { ...u, status: "retired" } : u
              ),
            };
          })
        );
      }

      const newLog: OutLog = {
        id: res.processedCodes?.[0]?.slice(-8) || "NEW",
        date: outDate,
        noRef: noRef || "-",
        itemName,
        category: catName,
        qty: mode === "new" ? newQty : selectedUnitIds.length,
        qrCodes: res.processedCodes || [],
        reason,
        recipient,
        target: target || "-",
        notes,
      };

      setLogs((prev) => [newLog, ...prev]);
      setSelectedUnitIds([]);
      setNoRef("");
      setTarget("");
      setRecipient("");
      setNotes("");
      if (mode === "new") setNewItemName("");
      setFeedback({ type: "success", text: "Pengeluaran barang dan status unit berhasil diperbarui di database." });
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Barang Keluar</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Pencatatan pengeluaran permanen: rusak berat, mutasi pos lain, atau barang habis pakai ({locationName}).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Barang Keluar */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
        >
          <h2 className="text-sm font-semibold text-white">Form Pengeluaran Barang</h2>

          <div className="flex gap-2 p-1 bg-zinc-950/80 rounded-lg border border-zinc-800 w-fit">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                mode === "existing" ? "bg-red-600 text-white" : "text-zinc-400"
              }`}
            >
              Master Barang Terdaftar
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                mode === "new" ? "bg-red-600 text-white" : "text-zinc-400"
              }`}
            >
              Barang Jenis Baru
            </button>
          </div>

          {mode === "existing" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Pilih Master Barang</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setSelectedUnitIds([]);
                  }}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
                >
                  {items.map((it) => {
                    const availCount = it.units.filter((u) => u.status === "available").length;
                    return (
                      <option key={it.id} value={it.id}>
                        {it.name} ({availCount} unit tersedia)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Alasan Pengeluaran</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="Afkir / Rusak Berat">Afkir / Rusak Berat (Pemusnahan)</option>
                  <option value="Mutasi Antar Pos SAR">Mutasi / Kirim ke Pos SAR Lain</option>
                  <option value="Habis Pakai / Konsumsi">Barang Habis Pakai (Operasi SAR)</option>
                  <option value="Hilang dalam Operasi">Hilang dalam Operasi SAR</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nama Barang Baru</label>
                <input
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Contoh: Logistik Darurat"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Kategori</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Jumlah Unit Dikeluarkan</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          )}

          {mode === "existing" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-zinc-400">
                  Pilih Unit Fisik (QR) yang dikeluarkan ({availableUnits.length} unit tersedia)
                </label>
                <span className="text-xs text-red-400 font-medium">
                  {selectedUnitIds.length} unit dipilih
                </span>
              </div>

              {availableUnits.length === 0 ? (
                <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Tidak ada unit yang berstatus available/siap untuk dikeluarkan.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-zinc-800 rounded-lg bg-zinc-950/60">
                  {availableUnits.map((u) => {
                    const isChecked = selectedUnitIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "border-red-500 bg-red-950/40 text-red-200"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUnitIds([...selectedUnitIds, u.id]);
                            } else {
                              setSelectedUnitIds(selectedUnitIds.filter((id) => id !== u.id));
                            }
                          }}
                          className="rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-0"
                        />
                        <span className="font-mono truncate">{u.qrCode}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tanggal Keluar</label>
              <input
                type="date"
                required
                value={outDate}
                onChange={(e) => setOutDate(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Nama Penerima / PJ <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Nama personil / petugas"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tujuan / Pos Penerima</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Contoh: Pos SAR Pasaman / Gudang Afkir"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">No. Berita Acara / Surat Keluar</label>
              <input
                value={noRef}
                onChange={(e) => setNoRef(e.target.value)}
                placeholder="BA-2026/MUTASI/..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Catatan Kronologis</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kronologis kerusakan, kondisi, atau penerima barang..."
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
            />
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs ${
                feedback.type === "success"
                  ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                  : "bg-red-950/60 border border-red-800 text-red-300"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isPending ||
                (mode === "existing" &&
                  (selectedUnitIds.length === 0 ||
                    selectedUnitIds.length > availableUnits.length))
              }
              className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 text-sm font-medium transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Proses Pengeluaran ({mode === "new" ? newQty : selectedUnitIds.length} unit)
                </>
              )}
            </button>
          </div>
        </form>

        {/* Ringkasan Panel Samping */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Panduan Pengeluaran</h3>
          <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
            <li>
              <strong className="text-zinc-200">Afkir:</strong> Unit berstatus rusak berat atau tidak layak operasi; stiker QR akan diarsipkan.
            </li>
            <li>
              <strong className="text-zinc-200">Mutasi:</strong> Pengiriman unit ke Pos SAR lain dalam naungan SAR.
            </li>
            <li>
              <strong className="text-zinc-200">Habis Pakai:</strong> Logistik habis terpakai selama misi operasi SAR.
            </li>
          </ul>

          <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
            <p className="text-xs text-zinc-400">Total Unit Terpilih:</p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {mode === "new" ? newQty : selectedUnitIds.length} Unit
            </p>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Barang Keluar + Filter & Laporan */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Riwayat Barang Keluar
              </h2>
              <p className="text-xs text-zinc-400">
                Filter transaksi berdasarkan periode atau cetak laporan logistik resmi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-zinc-700 transition-colors"
                title="Cetak Laporan Periode"
              >
                <Printer className="w-3.5 h-3.5 text-red-400" />
                <span>Cetak Laporan</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-zinc-700 transition-colors"
                title="Export data ke CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari penerima / barang / BA / QR..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="all">Semua Bulan</option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {String(i + 1).padStart(2, "0")} - {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map((y) => (
                  <option key={y} value={String(y)}>
                    Tahun {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1 flex items-center">
              {(filterMonth !== "all" || filterYear !== "all" || search) && (
                <button
                  type="button"
                  onClick={resetFilter}
                  className="w-full h-full flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"
                  title="Reset Filter"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div>
              Periode: <strong className="text-zinc-200">{activePeriodLabel}</strong>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Total Transaksi: <strong className="text-white">{filteredLogs.length}</strong>
              </span>
              <span>
                Total Unit Keluar: <strong className="text-red-400">-{totalFilteredQty} unit</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Tabel Data Bersih - Setiap Field Kolom Masing-Masing */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm divide-y divide-zinc-800">
              <thead className="bg-zinc-950/80">
                <tr>
                  <th className="px-3.5 py-3 text-center text-xs font-semibold text-zinc-400 w-12">No</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">ID Transaksi</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Tanggal Keluar</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">No. Dokumen / BA</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Nama Barang</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Kategori</th>
                  <th className="px-3.5 py-3 text-center text-xs font-semibold text-zinc-400 whitespace-nowrap">Jumlah</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Alasan</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Penerima</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Tujuan</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 min-w-[140px] max-w-[200px]">Catatan</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 min-w-[160px]">Kode QR Unit</th>
                  <th className="px-3.5 py-3 text-right text-xs font-semibold text-zinc-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-zinc-500 text-sm">
                      Tidak ada riwayat transaksi barang keluar yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3.5 py-3 text-center text-zinc-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                          {log.displayId || log.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-zinc-200 whitespace-nowrap font-medium">
                        {formatTanggalID(log.date)}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs text-zinc-300 whitespace-nowrap">
                        {log.noRef || "-"}
                      </td>
                      <td className="px-3.5 py-3 font-semibold text-white whitespace-nowrap">
                        {log.itemName}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-zinc-800 text-zinc-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-900/60">
                          -{log.qty} unit
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-zinc-300 whitespace-nowrap">
                        {log.reason}
                      </td>
                      <td className="px-3.5 py-3 text-zinc-100 font-medium whitespace-nowrap">
                        {log.recipient}
                      </td>
                      <td className="px-3.5 py-3 text-zinc-300 whitespace-nowrap">
                        {log.target}
                      </td>
                      <td className="px-3.5 py-3 text-zinc-400 max-w-[200px] break-words text-xs">
                        {log.notes || "-"}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.qrCodes.slice(0, 2).map((qr) => (
                            <span
                              key={qr}
                              className="font-mono text-[11px] bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 whitespace-nowrap"
                            >
                              {qr}
                            </span>
                          ))}
                          {log.qrCodes.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setViewingQrLog(log)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-orange-400 hover:text-orange-300 border border-zinc-700 transition-colors whitespace-nowrap"
                            >
                              +{log.qrCodes.length - 2} lagi
                            </button>
                          )}
                          {log.qrCodes.length <= 2 && log.qrCodes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewingQrLog(log)}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="Lihat Detail QR"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(log)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                            title="Edit Riwayat"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-red-400 hover:border-red-900/50 transition-colors"
                            title="Hapus Riwayat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Lihat Detail Kode QR */}
      <Modal
        open={Boolean(viewingQrLog)}
        onClose={() => setViewingQrLog(null)}
        title="Daftar Kode QR Unit Fisik Keluar"
        titleIcon={<QrCode className="w-5 h-5 text-red-400" />}
      >
        {viewingQrLog && (
          <div className="space-y-4 p-1">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <p className="text-sm font-semibold text-white">{viewingQrLog.itemName}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Total: <strong className="text-red-400">-{viewingQrLog.qty} unit</strong> · Keluar: {formatTanggalID(viewingQrLog.date)}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Penerima: <span className="text-zinc-200">{viewingQrLog.recipient}</span> ({viewingQrLog.target})
              </p>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {viewingQrLog.qrCodes.map((code, i) => (
                <div
                  key={code}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-zinc-500 font-mono text-[11px]">#{i + 1}</span>
                    <span className="font-mono text-zinc-200 font-medium">{code}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      alert(`Kode QR ${code} disalin ke clipboard.`);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    Salin
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Edit Riwayat Barang Keluar */}
      <Modal
        open={Boolean(editingLog)}
        onClose={() => setEditingLog(null)}
        title="Edit Riwayat Barang Keluar"
        titleIcon={<Pencil className="w-5 h-5 text-red-400" />}
      >
        {editingLog && (
          <form onSubmit={handleUpdateSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-zinc-400">Barang:</p>
              <p className="text-sm font-semibold text-white">
                {editingLog.itemName} ({editingLog.qty} unit)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tanggal Keluar</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Nama Penerima / PJ <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                  placeholder="Nama penerima..."
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Alasan Pengeluaran</label>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="Afkir / Rusak Berat">Afkir / Rusak Berat (Pemusnahan)</option>
                  <option value="Mutasi Antar Pos SAR">Mutasi / Kirim ke Pos SAR Lain</option>
                  <option value="Habis Pakai / Konsumsi">Barang Habis Pakai (Operasi SAR)</option>
                  <option value="Hilang dalam Operasi">Hilang dalam Operasi SAR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tujuan / Pos Penerima</label>
                <input
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder="Contoh: Pos SAR Pasaman / Gudang Afkir"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">No. Berita Acara / Surat Keluar</label>
              <input
                value={editNoRef}
                onChange={(e) => setEditNoRef(e.target.value)}
                placeholder="BA-2026/MUTASI/..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Catatan Tambahan</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan kronologis..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Simpan Perubahan
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
