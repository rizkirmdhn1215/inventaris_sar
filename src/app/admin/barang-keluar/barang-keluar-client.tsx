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
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  submitBarangKeluarAction,
  updateBarangKeluarLogAction,
  deleteBarangKeluarLogAction,
} from "./actions";
import { Modal } from "@/components/modal";
import { formatTanggalID } from "@/lib/format";
import { printInventoryReport, exportInventoryToCsv } from "@/lib/inventory-report-print";
import { SignaturePad } from "@/components/signature-pad";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";

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

export type StaffOption = {
  nip: string;
  name: string;
  jabatan: string;
};

function generateAutoDocNo(
  dateStr: string,
  typeCode: "M" | "K",
  existingLogs: { date: string; noRef: string }[]
): string {
  const parts = (dateStr || "").split("-");
  const now = new Date();
  const year = Number(parts[0]) || now.getFullYear();
  const month = Number(parts[1]) || now.getMonth() + 1;
  const day = Number(parts[2]) || now.getDate();

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  let maxSeq = 0;
  for (const log of existingLogs) {
    const [ly, lm] = (log.date || "").split("-").map(Number);
    if (ly === year && lm === month && log.noRef && log.noRef !== "-") {
      const match = log.noRef.trim().match(/^(\d+)\//);
      if (match) {
        const num = Number(match[1]);
        if (num > maxSeq) maxSeq = num;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(2, "0");
  return `${nextSeq}/${typeCode}/PL.${mm}.${dd}/I/GDG SAR PDG-${year}`;
}

type DraftOutboundItem = {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unitIds: string[];
  qrCodes: string[];
  qty: number;
  notes: string;
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
  staffRoster = [],
  initialLogs,
}: {
  locationId: string;
  locationSlug: string;
  locationName: string;
  items: MasterItemWithUnits[];
  categories: CategoryOption[];
  staffRoster?: StaffOption[];
  initialLogs: OutLog[];
}) {
  const [items, setItems] = useState<MasterItemWithUnits[]>(initialItems);
  const [logs, setLogs] = useState<OutLog[]>(initialLogs);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedItemId, setSelectedItemId] = useState(initialItems[0]?.id ?? "");
  const [outDate, setOutDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [quickQtyInput, setQuickQtyInput] = useState<string>("");
  const [unitSearch, setUnitSearch] = useState<string>("");
  const [onlySelectedUnits, setOnlySelectedUnits] = useState(false);
  const [reason, setReason] = useState("Afkir / Rusak Berat");
  const [recipient, setRecipient] = useState("");
  const [target, setTarget] = useState("");
  const [noRef, setNoRef] = useState(() =>
    generateAutoDocNo(new Date().toISOString().slice(0, 10), "K", initialLogs)
  );
  const [isCustomNoRef, setIsCustomNoRef] = useState(false);
  const [notes, setNotes] = useState("");
  const [draftItems, setDraftItems] = useState<DraftOutboundItem[]>([]);

  // State modal cetak surat pengeluaran (BAST) dari form (3 TTD: Penerima, Petugas Gudang, Pengawas Gudang)
  const [openBastModal, setOpenBastModal] = useState(false);
  const [openConfirmSaveModal, setOpenConfirmSaveModal] = useState(false);
  const [isBatchSaved, setIsBatchSaved] = useState(false);
  const [bastSignTab, setBastSignTab] = useState<"penerima" | "petugas" | "pengawas">("penerima");
  const [bastRecipientName, setBastRecipientName] = useState("");
  const [bastRecipientSignature, setBastRecipientSignature] = useState<string | null>(null);

  // Filter state (default: bulan & tahun sekarang)
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(() => String(new Date().getFullYear()));
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  // State cetak laporan & tanda tangan
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
  const [customPengawasName, setCustomPengawasName] = useState(
    DEFAULT_PENGAWAS_GUDANG.name || "ALVIZAN Z., S.H."
  );
  const [customPengawasNip, setCustomPengawasNip] = useState(
    DEFAULT_PENGAWAS_GUDANG.nip || "197312301998031003"
  );
  const [petugasSignature, setPetugasSignature] = useState<string | null>(null);
  const [pengawasSignature, setPengawasSignature] = useState<string | null>(null);
  const [activeSignTab, setActiveSignTab] = useState<"penerima" | "petugas" | "pengawas">("penerima");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);

  const availableYears = useMemo(() => {
    const setYears = new Set<number>();
    setYears.add(new Date().getFullYear());
    logs.forEach((log) => {
      const y = new Date(log.date).getFullYear();
      if (!Number.isNaN(y)) setYears.add(y);
    });
    return Array.from(setYears).sort((a, b) => b - a);
  }, [logs]);

  // Hitung otomatis displayId berformat BKL-YYYYMMDD-XXXX (reset ke 0001 tiap ganti tanggal)
  const logsWithDisplayId = useMemo(() => {
    const dailyTotal = new Map<string, number>();
    for (const l of logs) {
      dailyTotal.set(l.date, (dailyTotal.get(l.date) ?? 0) + 1);
    }
    const dailySeen = new Map<string, number>();
    return logs.map((l) => {
      const seen = dailySeen.get(l.date) ?? 0;
      const total = dailyTotal.get(l.date) ?? 1;
      const seq = total - seen;
      dailySeen.set(l.date, seen + 1);
      const ymd = (l.date || "").replace(/-/g, "");
      return {
        ...l,
        displayId: `BKL-${ymd}-${String(seq).padStart(4, "0")}`,
      };
    });
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logsWithDisplayId.filter((log) => {
      const d = new Date(log.date);
      const logYear = d.getFullYear();
      const logMonth = d.getMonth() + 1;
      if (filterYear !== "all" && logYear !== Number(filterYear)) return false;
      if (filterMonth !== "all" && logMonth !== Number(filterMonth)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (log.displayId?.toLowerCase().includes(q) ?? false) ||
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
  }, [logsWithDisplayId, filterYear, filterMonth, search]);

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
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (effectiveCurrentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, effectiveCurrentPage, pageSize]);

  function handlePrintReport() {
    setOpenPrintModal(true);
  }

  async function handleConfirmPrint() {
    let finalPetugasName = customSignerName.trim();
    let finalPetugasNip = customSignerNip.trim();

    if (!finalPetugasName) {
      const staff = staffRoster.find((s) => s.nip === selectedStaffNip);
      finalPetugasName = staff ? staff.name : (staffRoster[0]?.name ?? "Petugas Gudang SAR");
      finalPetugasNip = staff ? staff.nip : (staffRoster[0]?.nip ?? "");
    }

    const finalPengawasName = customPengawasName.trim() || DEFAULT_PENGAWAS_GUDANG.name;
    const finalPengawasNip = customPengawasNip.trim() || DEFAULT_PENGAWAS_GUDANG.nip;

    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/admin/inventory-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          lokasi: locationSlug,
          bulan: filterMonth,
          tahun: filterYear,
          search: search.trim() || undefined,
          pengirim:
            bastRecipientName.trim() ||
            filteredLogs.find((l) => l.recipient?.trim() && l.recipient.trim() !== "-")?.recipient ||
            "................................",
          pengirimSignatureDataUrl: bastRecipientSignature,
          petugas: finalPetugasName,
          nip: finalPetugasNip,
          pengawas: finalPengawasName,
          pengawasNip: finalPengawasNip,
          petugasSignatureDataUrl: petugasSignature,
          pengawasSignatureDataUrl: pengawasSignature,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal membuat file PDF laporan");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setOpenPrintModal(false);
    } catch (err) {
      alert("Terjadi kesalahan saat memproses PDF laporan: " + (err as Error).message);
    } finally {
      setIsGeneratingPdf(false);
    }
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

  const draftedUnitIds = useMemo(() => {
    if (isBatchSaved) return new Set<string>();
    return new Set(draftItems.flatMap((d) => d.unitIds));
  }, [draftItems, isBatchSaved]);

  const activeItem = items.find((i) => i.id === selectedItemId);
  // Requirement 5: Hanya unit berstatus available dan belum masuk daftar draft
  const availableUnits =
    activeItem?.units.filter((u) => u.status === "available" && !draftedUnitIds.has(u.id)) ?? [];

  function buildCurrentFormItem(): DraftOutboundItem {
    const selectedUnits = activeItem?.units.filter((u) => selectedUnitIds.includes(u.id)) ?? [];
    return {
      id: `draft-out-${Date.now()}`,
      itemId: selectedItemId,
      itemName: activeItem?.name ?? "Barang",
      categoryName: activeItem?.categoryName ?? "-",
      unitIds: selectedUnitIds,
      qrCodes: selectedUnits.map((u) => u.qrCode),
      qty: selectedUnitIds.length,
      notes: notes.trim(),
    };
  }

  function getEffectiveFormItems(): DraftOutboundItem[] {
    if (draftItems.length > 0) return draftItems;
    return [buildCurrentFormItem()];
  }

  function handleResetFormBatch() {
    setIsBatchSaved(false);
    setDraftItems([]);
    setSelectedUnitIds([]);
    setQuickQtyInput("");
    setFeedback(null);
    setNotes("");
    setIsCustomNoRef(false);
    setNoRef(generateAutoDocNo(outDate, "K", logs));
  }

  function handleAddDraftItem() {
    if (selectedUnitIds.length === 0) {
      setFeedback({
        type: "error",
        text: "Pilih minimal 1 unit fisik (QR Code) sebelum ditambahkan ke daftar surat.",
      });
      return;
    }
    setFeedback(null);
    const entry = buildCurrentFormItem();
    if (isBatchSaved) {
      setIsBatchSaved(false);
      setDraftItems([entry]);
    } else {
      setDraftItems((prev) => [...prev, entry]);
    }
    setSelectedUnitIds([]);
    setQuickQtyInput("");
    setNotes("");
  }

  function handleRemoveDraftItem(id: string) {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleOpenBastModal() {
    const effective = getEffectiveFormItems();
    if (effective.every((it) => it.qty === 0)) {
      setFeedback({
        type: "error",
        text: "Pilih minimal 1 unit fisik (QR Code) atau tambahkan barang ke daftar sebelum mencetak surat.",
      });
      return;
    }
    setFeedback(null);
    setBastRecipientName(recipient.trim() || "");
    setOpenBastModal(true);
  }

  async function handleConfirmBastPrint() {
    let finalPetugasName = customSignerName.trim();
    let finalPetugasNip = customSignerNip.trim();

    if (!finalPetugasName) {
      const staff = staffRoster.find((s) => s.nip === selectedStaffNip);
      finalPetugasName = staff ? staff.name : (staffRoster[0]?.name || "Petugas Gudang SAR");
      finalPetugasNip = staff ? staff.nip : (staffRoster[0]?.nip ?? "");
    }

    const finalPengawasName = customPengawasName.trim() || DEFAULT_PENGAWAS_GUDANG.name;
    const finalPengawasNip = customPengawasNip.trim() || DEFAULT_PENGAWAS_GUDANG.nip;
    const activeItems = getEffectiveFormItems();

    const customRows = activeItems.map((it, idx) => ({
      id: it.id || String(idx + 1),
      date: outDate,
      noRef: noRef.trim() || "-",
      itemName: it.itemName,
      category: it.categoryName || "-",
      qty: it.qty,
      sourceOrReason: reason,
      recipient: bastRecipientName.trim() || recipient.trim() || "-",
      target: target.trim() || "-",
      notes: it.notes,
      qrCodes: it.qrCodes,
    }));

    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/admin/inventory-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          lokasi: locationSlug,
          customTitle: "BERITA ACARA PENGELUARAN BARANG",
          customDocNumber: noRef.trim() || undefined,
          customPeriodLabel: formatTanggalID(outDate),
          customRows,
          pengirim: bastRecipientName.trim() || recipient.trim() || "................................",
          pengirimSignatureDataUrl: bastRecipientSignature,
          petugas: finalPetugasName,
          nip: finalPetugasNip,
          pengawas: finalPengawasName,
          pengawasNip: finalPengawasNip,
          petugasSignatureDataUrl: petugasSignature,
          pengawasSignatureDataUrl: pengawasSignature,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal membuat file PDF surat pengeluaran");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setOpenBastModal(false);
    } catch (err) {
      alert("Terjadi kesalahan saat memproses PDF surat: " + (err as Error).message);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleQuickSelectQty(count: number) {
    const targetCount = Math.max(0, Math.min(count, availableUnits.length));
    const sliceIds = availableUnits.slice(0, targetCount).map((u) => u.id);
    setSelectedUnitIds(sliceIds);
    setQuickQtyInput(targetCount > 0 ? String(targetCount) : "");
  }

  function handleSelectAllUnits() {
    setSelectedUnitIds(availableUnits.map((u) => u.id));
    setQuickQtyInput(String(availableUnits.length));
  }

  function handleClearUnits() {
    setSelectedUnitIds([]);
    setQuickQtyInput("");
  }

  const displayedUnits = useMemo(() => {
    let list = availableUnits;
    if (onlySelectedUnits) {
      list = list.filter((u) => selectedUnitIds.includes(u.id));
    }
    if (unitSearch.trim()) {
      const q = unitSearch.trim().toLowerCase();
      list = list.filter((u) => u.qrCode.toLowerCase().includes(q));
    }
    return list;
  }, [availableUnits, onlySelectedUnits, selectedUnitIds, unitSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBatchSaved) return;
    setFeedback(null);

    if (!outDate) {
      setFeedback({ type: "error", text: "Tanggal keluar wajib diisi." });
      return;
    }
    if (draftItems.length === 0 && selectedUnitIds.length === 0) {
      setFeedback({ type: "error", text: "Pilih minimal 1 unit fisik (QR Code) yang dikeluarkan." });
      return;
    }
    if (!recipient.trim()) {
      setFeedback({ type: "error", text: "Nama penerima / penanggung jawab wajib diisi." });
      return;
    }

    setOpenConfirmSaveModal(true);
  }

  function handleConfirmSubmit() {
    setOpenConfirmSaveModal(false);
    setFeedback(null);

    const itemsToSubmit = getEffectiveFormItems();

    startTransition(async () => {
      const newLogsBatch: OutLog[] = [];
      const retiredUnitIdSet = new Set<string>();
      const updatedDrafts: DraftOutboundItem[] = [];

      for (const entry of itemsToSubmit) {
        const formData = new FormData();
        formData.set("locationId", locationId);
        formData.set("mode", "existing");
        formData.set("itemId", entry.itemId);
        formData.set("date", outDate);
        formData.set("reason", reason);
        formData.set("recipient", recipient);
        formData.set("target", target);
        formData.set("referenceNo", noRef);
        formData.set("notes", entry.notes);
        entry.unitIds.forEach((uid) => formData.append("unitIds", uid));

        const res = await submitBarangKeluarAction(formData);
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
          return;
        }

        entry.unitIds.forEach((uid) => retiredUnitIdSet.add(uid));
        const processedCodes = res.processedCodes || entry.qrCodes;

        newLogsBatch.push({
          id: processedCodes[0]?.slice(-8) || `NEW-${Date.now()}`,
          date: outDate,
          noRef: noRef || "-",
          itemName: entry.itemName,
          category: entry.categoryName,
          qty: entry.qty,
          qrCodes: processedCodes,
          reason,
          recipient,
          target: target || "-",
          notes: entry.notes,
        });

        updatedDrafts.push({
          ...entry,
          qrCodes: processedCodes,
        });
      }

      setItems((prevItems) =>
        prevItems.map((it) => ({
          ...it,
          units: it.units.map((u) =>
            retiredUnitIdSet.has(u.id) ? { ...u, status: "retired" } : u
          ),
        }))
      );

      if (newLogsBatch.length > 0) {
        setLogs((prev) => [...newLogsBatch, ...prev]);
      }
      setDraftItems(updatedDrafts);
      setSelectedUnitIds([]);
      setQuickQtyInput("");
      setNotes("");
      setIsBatchSaved(true);
      setFeedback({
        type: "success",
        text: `${itemsToSubmit.length} jenis barang keluar berhasil disimpan di database. Tombol simpan dikunci agar tidak double input — silakan klik "Cetak Surat Pengeluaran" atau "Input Pengeluaran Baru".`,
      });
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Barang Keluar</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Pencatatan pengeluaran permanen: rusak berat, mutasi pos lain, atau hilang dalam operasi ({locationName}).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Barang Keluar */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Form Pengeluaran Barang</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pilih item dari master barang dan tandai nomor QR fisik yang dikeluarkan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Pilih Master Barang</label>
              <select
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  setSelectedUnitIds([]);
                  setQuickQtyInput("");
                  setUnitSearch("");
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
                <option value="Hilang dalam Operasi">Hilang dalam Operasi SAR</option>
              </select>
            </div>
          </div>

          {/* Kotak Pemilihan Unit Fisik yang Cepat & Efisien */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-semibold text-white">
                  Pilih Unit Fisik (QR) yang Dikeluarkan
                </label>
                <p className="text-[11px] text-zinc-400">
                  {availableUnits.length} unit tersedia ·{" "}
                  <strong className="text-red-400 font-bold">{selectedUnitIds.length} unit dipilih</strong>
                </p>
              </div>

              {/* Tombol Shortcut Pilih Cepat */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-500 mr-1">Pilih cepat:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSelectQty(1)}
                  disabled={availableUnits.length < 1}
                  className="px-2 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelectQty(5)}
                  disabled={availableUnits.length < 5}
                  className="px-2 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelectQty(10)}
                  disabled={availableUnits.length < 10}
                  className="px-2 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  10
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllUnits}
                  disabled={availableUnits.length === 0}
                  className="px-2.5 py-1 rounded text-[11px] bg-red-950/60 hover:bg-red-900/60 disabled:opacity-40 text-red-300 border border-red-800 transition-colors font-medium"
                >
                  Semua ({availableUnits.length})
                </button>
                {selectedUnitIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearUnits}
                    className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Input Jumlah Langsung & Filter Pencarian QR */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-zinc-800/80">
              <div className="sm:col-span-4 flex items-center gap-2">
                <label className="text-xs text-zinc-400 shrink-0">Ambil Jumlah:</label>
                <input
                  type="number"
                  min={1}
                  max={availableUnits.length}
                  value={quickQtyInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickQtyInput(val);
                    const n = parseInt(val, 10);
                    if (!isNaN(n) && n > 0) {
                      handleQuickSelectQty(n);
                    } else if (val === "") {
                      setSelectedUnitIds([]);
                    }
                  }}
                  placeholder={`1 - ${availableUnits.length}`}
                  className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="sm:col-span-5 relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="Cari nomor urut / QR (mis. 0001)..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="sm:col-span-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setOnlySelectedUnits(!onlySelectedUnits)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-colors w-full sm:w-auto text-center ${
                    onlySelectedUnits
                      ? "bg-red-600 text-white border-red-500"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                  }`}
                >
                  {onlySelectedUnits ? "Lihat Semua" : `Filter Terpilih (${selectedUnitIds.length})`}
                </button>
              </div>
            </div>

            {/* List unit fisik */}
            {availableUnits.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Tidak ada unit yang berstatus available/siap untuk dikeluarkan.
              </p>
            ) : displayedUnits.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-3 text-center border border-dashed border-zinc-800 rounded-lg">
                Tidak ada unit yang cocok dengan filter pencarian.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-52 overflow-y-auto p-2 border border-zinc-800 rounded-lg bg-zinc-900/40">
                {displayedUnits.map((u) => {
                  const isChecked = selectedUnitIds.includes(u.id);
                  const parts = u.qrCode.split("-");
                  const unitNumber = parts[parts.length - 1] || u.qrCode;

                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer select-none transition-colors ${
                        isChecked
                          ? "border-red-500 bg-red-950/60 text-white font-medium"
                          : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
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
                        className="rounded border-zinc-700 bg-zinc-800 text-red-500 focus:ring-0 shrink-0"
                      />
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] truncate text-zinc-400" title={u.qrCode}>
                          {u.qrCode}
                        </span>
                        <span className="text-[10px] font-mono px-1 rounded bg-zinc-800/80 text-orange-400 shrink-0">
                          #{unitNumber}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tanggal Keluar</label>
              <input
                type="date"
                required
                value={outDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setOutDate(nextDate);
                  if (!isCustomNoRef && !isBatchSaved) {
                    setNoRef(generateAutoDocNo(nextDate, "K", logs));
                  }
                }}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-zinc-400">No. Berita Acara / Surat Keluar</label>
                {isCustomNoRef && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomNoRef(false);
                      setNoRef(generateAutoDocNo(outDate, "K", logs));
                    }}
                    className="text-[10px] text-red-400 hover:underline"
                    title="Kembalikan ke nomor otomatis"
                  >
                    Reset Otomatis
                  </button>
                )}
              </div>
              <input
                value={noRef}
                onChange={(e) => {
                  setNoRef(e.target.value);
                  setIsCustomNoRef(true);
                }}
                placeholder="01/K/PL.11.10/I/GDG SAR PDG-2026"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-zinc-400">Catatan Kronologis</label>
              <button
                type="button"
                onClick={handleAddDraftItem}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-red-400 hover:text-red-300 px-2.5 py-1 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Barang ke Daftar Surat
              </button>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kronologis kerusakan, kondisi, atau penerima barang..."
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-red-500"
            />
          </div>

          {draftItems.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>
                    Daftar Barang Keluar ({draftItems.length} jenis ·{" "}
                    {draftItems.reduce((sum, it) => sum + it.qty, 0)} unit)
                  </span>
                  {isBatchSaved && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Sudah Tersimpan ✓
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleResetFormBatch}
                  className="text-[11px] text-zinc-400 hover:text-red-400"
                >
                  {isBatchSaved ? "Bersihkan / Input Baru" : "Kosongkan Daftar"}
                </button>
              </div>
              <div className="divide-y divide-zinc-800/60 max-h-48 overflow-y-auto">
                {draftItems.map((it, idx) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">
                        {idx + 1}. {it.itemName}{" "}
                        <span className="text-zinc-400 font-normal">({it.categoryName})</span>
                      </p>
                      {it.notes && (
                        <p className="text-[11px] text-zinc-400 truncate">Ket: {it.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-950/80 text-red-400 border border-red-900/60">
                        {it.qty} unit
                      </span>
                      {!isBatchSaved && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftItem(it.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Hapus dari daftar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpenBastModal}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 px-4 py-2 text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4 text-red-400" />
              Cetak Surat Pengeluaran
            </button>

            {isBatchSaved ? (
              <div className="flex items-center gap-2 ml-auto">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 border border-emerald-800/60 text-emerald-400 px-4 py-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Sudah Disimpan
                </span>
                <button
                  type="button"
                  onClick={handleResetFormBatch}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Input Pengeluaran Baru
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={
                  isPending ||
                  (draftItems.length === 0 &&
                    (selectedUnitIds.length === 0 ||
                      selectedUnitIds.length > availableUnits.length))
                }
                className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 text-sm font-medium transition-colors ml-auto"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Proses Pengeluaran (
                    {draftItems.length > 0
                      ? draftItems.reduce((sum, it) => sum + it.qty, 0)
                      : selectedUnitIds.length}{" "}
                    unit)
                  </>
                )}
              </button>
            )}
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
              <strong className="text-zinc-200">Hilang:</strong> Unit hilang dalam pelaksanaan operasi SAR.
            </li>
          </ul>

          <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
            <p className="text-xs text-zinc-400">Total Unit Terpilih:</p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {selectedUnitIds.length} Unit
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari penerima / barang / BA / QR..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setCurrentPage(1);
                }}
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
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-zinc-500 text-sm">
                      Tidak ada riwayat transaksi barang keluar yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3.5 py-3 text-center text-zinc-400 font-medium">
                        {(effectiveCurrentPage - 1) * pageSize + idx + 1}
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

          {/* Pagination Footer */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800/80 bg-zinc-950/40 text-xs">
              <span className="text-zinc-400">
                Menampilkan{" "}
                <strong className="text-white">
                  {(effectiveCurrentPage - 1) * pageSize + 1}
                </strong>{" "}
                -{" "}
                <strong className="text-white">
                  {Math.min(effectiveCurrentPage * pageSize, filteredLogs.length)}
                </strong>{" "}
                dari <strong className="text-white">{filteredLogs.length}</strong> transaksi
              </span>

              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={effectiveCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-medium text-zinc-200">
                  Halaman {effectiveCurrentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={effectiveCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Proses Pengeluaran Barang (Ya / Tidak) */}
      <Modal
        open={openConfirmSaveModal}
        onClose={() => setOpenConfirmSaveModal(false)}
        title="Konfirmasi Pengeluaran Barang"
        titleIcon={<CheckCircle2 className="w-5 h-5 text-red-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <p className="text-sm text-zinc-200">
            Apakah Anda yakin ingin menyimpan pengeluaran barang ini ke database?
          </p>

          {(() => {
            const duplicates = getEffectiveFormItems().filter((it) =>
              logs.some(
                (l) =>
                  l.date === outDate &&
                  l.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase() &&
                  l.qty === it.qty
              )
            );
            if (duplicates.length === 0) return null;
            return (
              <div className="rounded-xl bg-amber-950/60 border border-amber-800 p-3 text-amber-200 space-y-1">
                <p className="font-semibold text-amber-300">
                  Peringatan Kemungkinan Input Ganda (Double Input):
                </p>
                <p>
                  Barang dengan nama, jumlah unit, dan tanggal yang sama sudah tercatat di riwayat (
                  {duplicates.map((d) => `${d.itemName}: ${d.qty} unit`).join(", ")}). Pastikan Anda
                  belum menyimpan transaksi ini sebelumnya.
                </p>
              </div>
            );
          })()}

          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Tanggal Keluar:</span>
              <strong className="text-white">{formatTanggalID(outDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Alasan Pengeluaran:</span>
              <span className="text-zinc-200">{reason}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Penerima / Tujuan:</span>
              <span className="text-zinc-200">
                {recipient.trim() || "-"} / {target.trim() || "-"}
              </span>
            </div>
            <div className="pt-1.5 border-t border-zinc-800/80">
              <p className="text-zinc-400 mb-1">Rincian Barang:</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {getEffectiveFormItems().map((it, idx) => (
                  <div key={it.id} className="flex justify-between text-zinc-200">
                    <span className="truncate">
                      {idx + 1}. {it.itemName} ({it.categoryName})
                    </span>
                    <strong className="text-red-400 shrink-0 ml-2">{it.qty} unit</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setOpenConfirmSaveModal(false)}
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Tidak
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ya, Proses Pengeluaran</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Cetak Surat Pengeluaran Barang (BAST) dari Form - 3 TTD */}
      <Modal
        open={openBastModal}
        onClose={() => setOpenBastModal(false)}
        title="Cetak Surat Pengeluaran Barang"
        titleIcon={<Printer className="w-5 h-5 text-red-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Tanggal Keluar:</span>
              <strong className="text-white">{formatTanggalID(outDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">No. Berita Acara / Dokumen:</span>
              <span className="text-zinc-200 font-mono">{noRef.trim() || "Otomatis"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Alasan / Tujuan:</span>
              <span className="text-zinc-200">
                {reason} {target.trim() ? `(${target.trim()})` : ""}
              </span>
            </div>
            <div className="pt-1.5 border-t border-zinc-800/80">
              <p className="text-zinc-400 mb-1">Isi Tabel Barang Keluar:</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {getEffectiveFormItems().map((it, idx) => (
                  <div key={it.id} className="flex justify-between text-zinc-200">
                    <span className="truncate">
                      {idx + 1}. {it.itemName} ({it.categoryName})
                    </span>
                    <strong className="text-red-400 shrink-0 ml-2">{it.qty} unit</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Tab Pilihan Penandatangan: Penerima, Petugas Gudang, Pengawas Gudang */}
          <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setBastSignTab("penerima")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                bastSignTab === "penerima"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Penerima {bastRecipientSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setBastSignTab("petugas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                bastSignTab === "petugas"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Petugas Gudang {petugasSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setBastSignTab("pengawas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                bastSignTab === "pengawas"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengawas Gudang {pengawasSignature ? "✓" : ""}
            </button>
          </div>

          {bastSignTab === "penerima" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Nama Penerima / Penanggung Jawab
                </label>
                <input
                  value={bastRecipientName}
                  onChange={(e) => setBastRecipientName(e.target.value)}
                  placeholder="Nama Lengkap Penerima"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Penerima (Opsional)"
                  initialDataUrl={bastRecipientSignature}
                  onDataUrlChange={setBastRecipientSignature}
                />
              </div>
            </div>
          ) : bastSignTab === "petugas" ? (
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
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {staffRoster.map((s) => (
                    <option key={s.nip} value={s.nip}>
                      {s.name} ({s.jabatan})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Nama Petugas Gudang</label>
                  <input
                    value={customSignerName}
                    onChange={(e) => setCustomSignerName(e.target.value)}
                    placeholder="Nama Lengkap Petugas"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Petugas Gudang</label>
                  <input
                    value={customSignerNip}
                    onChange={(e) => setCustomSignerNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Petugas Gudang (Opsional)"
                  initialDataUrl={petugasSignature}
                  onDataUrlChange={setPetugasSignature}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Nama Pengawas Gudang</label>
                  <input
                    value={customPengawasName}
                    onChange={(e) => setCustomPengawasName(e.target.value)}
                    placeholder="Nama Pengawas Gudang"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Pengawas Gudang</label>
                  <input
                    value={customPengawasNip}
                    onChange={(e) => setCustomPengawasNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Pengawas Gudang (Opsional)"
                  initialDataUrl={pengawasSignature}
                  onDataUrlChange={setPengawasSignature}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setOpenBastModal(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmBastPrint}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Buka Dokumen Cetak</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Opsi Petugas Siaga & Cetak Laporan */}
      <Modal
        open={openPrintModal}
        onClose={() => setOpenPrintModal(false)}
        title="Cetak Laporan Barang Keluar"
        titleIcon={<Printer className="w-5 h-5 text-red-400" />}
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
              <span className="text-red-400 font-bold">{totalFilteredQty} unit</span>
            </div>
          </div>

          {/* Tab Pilihan Penandatangan */}
          <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveSignTab("penerima")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeSignTab === "penerima"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Penerima {bastRecipientSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveSignTab("petugas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeSignTab === "petugas"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Petugas Gudang {petugasSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveSignTab("pengawas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeSignTab === "pengawas"
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengawas Gudang {pengawasSignature ? "✓" : ""}
            </button>
          </div>

          {activeSignTab === "penerima" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Nama Penerima / Penanggung Jawab
                </label>
                <input
                  value={bastRecipientName}
                  onChange={(e) => setBastRecipientName(e.target.value)}
                  placeholder="Nama Lengkap Penerima (Kosongkan untuk ambil dari riwayat)"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Penerima (Opsional)"
                  initialDataUrl={bastRecipientSignature}
                  onDataUrlChange={setBastRecipientSignature}
                />
              </div>
            </div>
          ) : activeSignTab === "petugas" ? (
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
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {staffRoster.map((s) => (
                    <option key={s.nip} value={s.nip}>
                      {s.name} ({s.jabatan})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Nama Petugas Gudang</label>
                  <input
                    value={customSignerName}
                    onChange={(e) => setCustomSignerName(e.target.value)}
                    placeholder="Nama Lengkap Petugas"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Petugas Gudang</label>
                  <input
                    value={customSignerNip}
                    onChange={(e) => setCustomSignerNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Petugas Gudang (Opsional)"
                  initialDataUrl={petugasSignature}
                  onDataUrlChange={setPetugasSignature}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Nama Pengawas Gudang</label>
                  <input
                    value={customPengawasName}
                    onChange={(e) => setCustomPengawasName(e.target.value)}
                    placeholder="Nama Pengawas Gudang"
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Pengawas Gudang</label>
                  <input
                    value={customPengawasNip}
                    onChange={(e) => setCustomPengawasNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Pengawas Gudang (Opsional)"
                  initialDataUrl={pengawasSignature}
                  onDataUrlChange={setPengawasSignature}
                />
              </div>
            </div>
          )}

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
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Buka Dokumen Cetak</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

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
