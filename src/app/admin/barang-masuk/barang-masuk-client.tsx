"use client";

import { useState, useTransition, useMemo } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Search,
  CheckCircle2,
  Printer,
  Loader2,
  Pencil,
  Trash2,
  FileSpreadsheet,
  RotateCcw,
  Package,
} from "lucide-react";
import {
  submitBarangMasukAction,
  updateBarangMasukLogAction,
  deleteBarangMasukLogAction,
} from "./actions";
import { Modal } from "@/components/modal";
import { formatTanggalID } from "@/lib/format";
import { printInventoryReport, exportInventoryToCsv } from "@/lib/inventory-report-print";

export type MasterItemOption = {
  id: string;
  name: string;
  categoryName: string | null;
  merk: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
};

export type InLog = {
  id: string;
  displayId?: string;
  date: string;
  noRef: string;
  itemName: string;
  category: string;
  qty: number;
  qrCodes: string[];
  source: string;
  recipient?: string;
  sender?: string;
  notes?: string;
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export type StaffOption = {
  nip: string;
  name: string;
  jabatan: string;
};

export function BarangMasukClient({
  locationId,
  locationSlug,
  locationName,
  items: initialItems,
  categories,
  staffRoster,
  initialLogs,
}: {
  locationId: string;
  locationSlug: string;
  locationName: string;
  items: MasterItemOption[];
  categories: CategoryOption[];
  staffRoster: StaffOption[];
  initialLogs: InLog[];
}) {
  const [items, setItems] = useState<MasterItemOption[]>(initialItems);
  const [logs, setLogs] = useState<InLog[]>(initialLogs);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form input state
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedItemId, setSelectedItemId] = useState(initialItems[0]?.id ?? "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(categories[0]?.id ?? "");
  const [inDate, setInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState(1);
  const [source, setSource] = useState("Pengadaan APBN/Basarnas");
  const [noRef, setNoRef] = useState("");
  const [recipient, setRecipient] = useState(staffRoster[0]?.name ?? "");
  const [sender, setSender] = useState("");
  const [notes, setNotes] = useState("");
  const [previewQrs, setPreviewQrs] = useState<{ code: string; url: string }[]>([]);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // State edit log
  const [editingLog, setEditingLog] = useState<InLog | null>(null);
  const [viewingQrLog, setViewingQrLog] = useState<InLog | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editNoRef, setEditNoRef] = useState("");
  const [editRecipient, setEditRecipient] = useState("");
  const [editSender, setEditSender] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, startUpdating] = useTransition();

  // State pilihan petugas gudang siaga dinamis untuk cetak laporan
  const [selectedStaffNip, setSelectedStaffNip] = useState(
    staffRoster.find((s) => s.jabatan.toLowerCase().includes("gudang"))?.nip ||
      staffRoster[0]?.nip ||
      ""
  );
  const [customSignerName, setCustomSignerName] = useState(
    staffRoster.find((s) => s.jabatan.toLowerCase().includes("gudang"))?.name ||
      staffRoster[0]?.name ||
      "Rezky Purnama Sarta"
  );
  const [customSignerNip, setCustomSignerNip] = useState(
    staffRoster.find((s) => s.jabatan.toLowerCase().includes("gudang"))?.nip ||
      staffRoster[0]?.nip ||
      "192329303313123"
  );
  const [openPrintModal, setOpenPrintModal] = useState(false);

  // Extract available years from logs + current year
  const availableYears = useMemo(() => {
    const setYears = new Set<number>();
    setYears.add(new Date().getFullYear());
    logs.forEach((log) => {
      const y = new Date(log.date).getFullYear();
      if (!Number.isNaN(y)) setYears.add(y);
    });
    return Array.from(setYears).sort((a, b) => b - a);
  }, [logs]);

  // Filtered logs
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
          log.source.toLowerCase().includes(q) ||
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
    if (filterMonth !== "all") {
      return `Bulan ${MONTH_NAMES[Number(filterMonth) - 1]}`;
    }
    return `Tahun ${filterYear}`;
  }, [filterMonth, filterYear]);

  function resetFilter() {
    setSearch("");
    setFilterMonth("all");
    setFilterYear("all");
  }

  function handleConfirmPrint() {
    let finalName = customSignerName.trim();
    let finalNip = customSignerNip.trim();

    if (!finalName) {
      const staff = staffRoster.find((s) => s.nip === selectedStaffNip);
      finalName = staff ? staff.name : (staffRoster[0]?.name ?? "Petugas Gudang SAR");
      finalNip = staff ? staff.nip : (staffRoster[0]?.nip ?? "");
    }

    printInventoryReport({
      title: "SURAT LAPORAN BARANG MASUK",
      type: "in",
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
        sourceOrReason: l.source,
        sender: l.sender,
        recipient: l.recipient,
        notes: l.notes,
        qrCodes: l.qrCodes,
      })),
      totalQty: totalFilteredQty,
      signerName: finalName,
      signerNip: finalNip,
    });

    setOpenPrintModal(false);
  }

  function handleExportCsv() {
    exportInventoryToCsv({
      filename: `Laporan_Barang_Masuk_${locationSlug}_${activePeriodLabel.replace(/\s+/g, "_")}`,
      type: "in",
      rows: filteredLogs.map((l) => ({
        id: l.id,
        displayId: l.displayId,
        date: l.date,
        noRef: l.noRef,
        itemName: l.itemName,
        category: l.category,
        qty: l.qty,
        sourceOrReason: l.source,
        notes: l.notes,
        qrCodes: l.qrCodes,
      })),
    });
  }

  function openEdit(log: InLog) {
    setEditingLog(log);
    setEditDate(log.date);
    setEditSource(log.source);
    setEditNoRef(log.noRef === "-" ? "" : log.noRef);
    setEditRecipient(log.recipient || "");
    setEditSender(log.sender || "");
    setEditNotes(log.notes || "");
  }

  function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLog) return;

    const fd = new FormData();
    fd.set("id", editingLog.id);
    fd.set("date", editDate);
    fd.set("source", editSource);
    fd.set("referenceNo", editNoRef);
    fd.set("recipient", editRecipient);
    fd.set("sender", editSender);
    fd.set("notes", editNotes);

    startUpdating(async () => {
      const res = await updateBarangMasukLogAction(fd);
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
                source: editSource,
                noRef: editNoRef || "-",
                recipient: editRecipient,
                sender: editSender,
                notes: editNotes,
              }
            : l
        )
      );
      setEditingLog(null);
    });
  }

  function handleDelete(logId: string) {
    if (!window.confirm("Hapus riwayat barang masuk ini dari daftar?")) return;
    const fd = new FormData();
    fd.set("id", logId);

    startUpdating(async () => {
      const res = await deleteBarangMasukLogAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    });
  }

  async function generatePreview() {
    const itemName = mode === "existing"
      ? (items.find((i) => i.id === selectedItemId)?.name ?? "BARANG")
      : (newItemName || "BARANG");

    const codeSlug = itemName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    const locPrefix = (locationSlug || "SAR").toUpperCase();
    const generated: { code: string; url: string }[] = [];

    for (let i = 1; i <= qty; i++) {
      const code = `SAR-${locPrefix}-${codeSlug}-${String(i).padStart(4, "0")}`;
      const url = await QRCode.toDataURL(code, { width: 160, margin: 1 });
      generated.push({ code, url });
    }
    setPreviewQrs(generated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const formData = new FormData();
    formData.set("locationId", locationId);
    formData.set("mode", mode);
    formData.set("itemId", selectedItemId);
    formData.set("newItemName", newItemName);
    formData.set("newItemCategory", newItemCategory);
    formData.set("date", inDate);
    formData.set("quantity", String(qty));
    formData.set("source", source);
    formData.set("referenceNo", noRef);
    formData.set("recipient", recipient);
    formData.set("sender", sender);
    formData.set("notes", notes);

    const itemName = mode === "existing"
      ? (items.find((i) => i.id === selectedItemId)?.name ?? "Barang")
      : newItemName;
    const catName = mode === "existing"
      ? (items.find((i) => i.id === selectedItemId)?.categoryName ?? "-")
      : (categories.find((c) => c.id === newItemCategory)?.name ?? "-");

    startTransition(async () => {
      const res = await submitBarangMasukAction(formData);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
        return;
      }

      if (res.generatedCodes && res.generatedCodes.length > 0) {
        const previewList = await Promise.all(
          res.generatedCodes.map(async (code) => {
            const url = await QRCode.toDataURL(code, { width: 160, margin: 1 });
            return { code, url };
          })
        );
        setPreviewQrs(previewList);

        const newLog: InLog = {
          id: res.generatedCodes[0]?.slice(-8) || "NEW",
          date: inDate,
          noRef: noRef || "-",
          itemName: res.item?.name ?? itemName,
          category: res.item?.categoryName ?? catName,
          qty,
          qrCodes: res.generatedCodes,
          source,
          recipient,
          sender,
          notes,
        };
        setLogs((prev) => [newLog, ...prev]);
      }

      if (res.item) {
        setItems((prev) => {
          if (prev.some((it) => it.id === res.item!.id)) return prev;
          return [...prev, res.item!].sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedItemId(res.item.id);
      }

      setFeedback({ type: "success", text: "Barang masuk dan unit QR berhasil disimpan di database serta stok Master Barang diperbarui." });
      setNoRef("");
      setNotes("");
      if (mode === "new") setNewItemName("");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Barang Masuk</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Penerimaan barang baru/hibah/mutasi pos, generate QR stiker unit fisik ({locationName}).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Barang Masuk */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
        >
          <h2 className="text-sm font-semibold text-white">Form Penerimaan Barang</h2>

          <div className="flex gap-0 border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === "existing"
                  ? "text-white border-b-2 border-orange-500"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Master Barang Terdaftar
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                mode === "new"
                  ? "text-white border-b-2 border-orange-500"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Jenis Barang Baru
            </button>
          </div>

          {mode === "existing" ? (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Pilih Master Barang</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} {it.merk ? `(${it.merk})` : ""} - {it.categoryName ?? "Tanpa Kategori"}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nama Barang Baru</label>
                <input
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Contoh: Genset Honda 5kVA"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
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
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tanggal Masuk</label>
              <input
                type="date"
                required
                value={inDate}
                onChange={(e) => setInDate(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Jumlah Unit</label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Sumber Pengadaan</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              >
                <option value="Pengadaan APBN/Basarnas">Pengadaan APBN/Basarnas</option>
                <option value="Hibah Pemda/Instansi">Hibah Pemda/Instansi</option>
                <option value="Mutasi dari KPP/Pos Lain">Mutasi dari KPP/Pos Lain</option>
                <option value="Selesai Servis/Perbaikan">Selesai Servis/Perbaikan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">No. BAST / Dokumen</label>
              <input
                value={noRef}
                onChange={(e) => setNoRef(e.target.value)}
                placeholder="BAST-2026/..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Penerima (Staff)</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              >
                <option value="">- Pilih Penerima -</option>
                {staffRoster.map((staff) => (
                  <option key={staff.nip} value={staff.name}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Pengirim (Input Manual)</label>
              <input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Nama pengirim / pihak penyerah"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Catatan Tambahan</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan kelengkapan atau serial number..."
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
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

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={generatePreview}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 text-sm font-medium transition-colors"
            >
              <QrCode className="w-4 h-4 text-orange-400" />
              Generate QR Tag
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium transition-colors ml-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Penerimaan
                </>
              )}
            </button>
          </div>
        </form>

        {/* QR Preview & Print Box */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Preview QR Tag Unit</h3>
            {previewQrs.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                className="text-xs text-orange-400 hover:underline flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Stiker
              </button>
            )}
          </div>

          {previewQrs.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-xs">
              Klik &quot;Generate QR Tag&quot; untuk membuat nomor stiker QR otomatis sesuai jumlah unit.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-95 overflow-y-auto pr-1">
              {previewQrs.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/80"
                >
                  <img src={item.url} alt={item.code} className="w-12 h-12 bg-white p-1 rounded" />
                  <div className="overflow-hidden">
                    <p className="text-xs font-mono font-medium text-white truncate">{item.code}</p>
                    <p className="text-[11px] text-zinc-400">Unit #{idx + 1} · {locationName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabel Riwayat Barang Masuk + Filter & Laporan */}
      <div className="space-y-4">
        {/* Header & Filter Controls Bar */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Riwayat Barang Masuk
              </h2>
              <p className="text-xs text-zinc-400">
                Filter transaksi berdasarkan periode atau cetak laporan logistik resmi.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenPrintModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white border border-zinc-700 transition-colors"
                title="Cetak Laporan Periode"
              >
                <Printer className="w-3.5 h-3.5 text-orange-400" />
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
                placeholder="Cari barang / BAST / sumber / QR..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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

          {/* Info Summary Periode Terpilih */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div>
              Periode: <strong className="text-zinc-200">{activePeriodLabel}</strong>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Total Transaksi: <strong className="text-white">{filteredLogs.length}</strong>
              </span>
              <span>
                Total Unit Masuk: <strong className="text-emerald-400">{totalFilteredQty} unit</strong>
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
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Tanggal Masuk</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">No. Dokumen / BAST</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Nama Barang</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Kategori</th>
                  <th className="px-3.5 py-3 text-center text-xs font-semibold text-zinc-400 whitespace-nowrap">Jumlah</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Sumber Pengadaan</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Penerima</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 whitespace-nowrap">Pengirim</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 min-w-[140px] max-w-[200px]">Catatan</th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold text-zinc-400 min-w-[160px]">Kode QR Unit</th>
                  <th className="px-3.5 py-3 text-right text-xs font-semibold text-zinc-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-zinc-500 text-sm">
                      Tidak ada riwayat transaksi barang masuk yang sesuai filter.
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-900/60">
                          {log.qty} unit
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-zinc-300 whitespace-nowrap">
                        {log.source}
                      </td>
                      <td className="px-3.5 py-3 text-zinc-300 whitespace-nowrap font-medium">
                        {log.recipient || "-"}
                      </td>
                      <td className="px-3.5 py-3 text-zinc-300 whitespace-nowrap">
                        {log.sender || "-"}
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

      {/* Modal Opsi Petugas Siaga & Cetak Laporan */}
      <Modal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Cetak Laporan Barang Masuk"
        titleIcon={<Printer className="w-5 h-5 text-orange-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-400">Periode Laporan:</span>
              <strong className="text-white">{activePeriodLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Transaksi:</span>
              <span className="text-zinc-200">{filteredLogs.length} transaksi</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Unit:</span>
              <span className="text-emerald-400 font-bold">{totalFilteredQty} unit</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Petugas Gudang yang Bertugas / Siaga
              </label>
              <select
                value={selectedStaffNip}
                onChange={(e) => {
                  setSelectedStaffNip(e.target.value);
                  const st = staffRoster.find((s) => s.nip === e.target.value);
                  if (st) {
                    setCustomSignerName(st.name);
                    setCustomSignerNip(st.nip);
                  }
                }}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {staffRoster.map((s) => (
                  <option key={s.nip} value={s.nip}>
                    {s.name} ({s.jabatan})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Nama Petugas Gudang</label>
                <input
                  value={customSignerName}
                  onChange={(e) => setCustomSignerName(e.target.value)}
                  placeholder="Nama Lengkap Petugas"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">NIP Petugas Gudang</label>
                <input
                  value={customSignerNip}
                  onChange={(e) => setCustomSignerNip(e.target.value)}
                  placeholder="NIP. ..."
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 italic">
              * Nama dan NIP di atas akan dicantumkan pada bagian tanda tangan Petugas Gudang di dokumen cetak.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setOpenPrintModal(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Buka Dokumen Cetak</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Lihat Detail Kode QR */}
      <Modal
        open={Boolean(viewingQrLog)}
        onClose={() => setViewingQrLog(null)}
        title="Daftar Kode QR Unit Fisik"
        titleIcon={<QrCode className="w-5 h-5 text-orange-400" />}
      >
        {viewingQrLog && (
          <div className="space-y-4 p-1">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <p className="text-sm font-semibold text-white">{viewingQrLog.itemName}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Total: <strong className="text-emerald-400">{viewingQrLog.qty} unit</strong> · Masuk: {formatTanggalID(viewingQrLog.date)}
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

      {/* Modal Edit Riwayat Barang Masuk */}
      <Modal
        open={Boolean(editingLog)}
        onClose={() => setEditingLog(null)}
        title="Edit Riwayat Barang Masuk"
        titleIcon={<Pencil className="w-5 h-5 text-orange-400" />}
      >
        {editingLog && (
          <form onSubmit={handleUpdateSubmit} className="space-y-6">
            {/* Barang Info Section */}
            <div className="bg-zinc-900/40 rounded-lg border border-zinc-800 p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Informasi Barang</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-white font-medium">{editingLog.itemName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-emerald-400 font-semibold">{editingLog.qty} unit</span>
                  <span>•</span>
                  <span>{editingLog.category}</span>
                </div>
              </div>
            </div>

            {/* Tanggal & Sumber Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pengadaan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">Tanggal Masuk</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">Sumber Pengadaan</label>
                  <select
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  >
                    <option value="Pengadaan APBN/Basarnas">Pengadaan APBN/Basarnas</option>
                    <option value="Hibah Pemda/Instansi">Hibah Pemda/Instansi</option>
                    <option value="Mutasi dari KPP/Pos Lain">Mutasi dari KPP/Pos Lain</option>
                    <option value="Selesai Servis/Perbaikan">Selesai Servis/Perbaikan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">No. BAST / Surat Terima</label>
                <input
                  value={editNoRef}
                  onChange={(e) => setEditNoRef(e.target.value)}
                  placeholder="BAST-2026/..."
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            {/* Penerima & Pengirim Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pihak Terkait</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">Penerima (Staff)</label>
                  <select
                    value={editRecipient}
                    onChange={(e) => setEditRecipient(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  >
                    <option value="">- Pilih Penerima -</option>
                    {staffRoster.map((staff) => (
                      <option key={staff.nip} value={staff.name}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">Pengirim</label>
                  <input
                    value={editSender}
                    onChange={(e) => setEditSender(e.target.value)}
                    placeholder="Nama pengirim / pihak penyerah"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Catatan Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Keterangan</h3>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan tambahan (serial number, kondisi, dll...)"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
