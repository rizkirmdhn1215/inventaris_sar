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
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  submitBarangMasukAction,
  updateBarangMasukLogAction,
  deleteBarangMasukLogAction,
} from "./actions";
import { Modal } from "@/components/modal";
import { formatTanggalID } from "@/lib/format";
import { printInventoryReport, exportInventoryToCsv } from "@/lib/inventory-report-print";
import { SignaturePad } from "@/components/signature-pad";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";

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

type DraftInboundItem = {
  id: string;
  mode: "existing" | "new";
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  notes: string;
  qrCodes: string[];
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
  const [noRef, setNoRef] = useState(() =>
    generateAutoDocNo(new Date().toISOString().slice(0, 10), "M", initialLogs)
  );
  const [isCustomNoRef, setIsCustomNoRef] = useState(false);
  const [recipient, setRecipient] = useState(staffRoster[0]?.name ?? "");
  const [sender, setSender] = useState("");
  const [notes, setNotes] = useState("");
  const [previewQrs, setPreviewQrs] = useState<{ code: string; url: string }[]>([]);
  const [draftItems, setDraftItems] = useState<DraftInboundItem[]>([]);

  // State modal cetak surat BAST dari form (3 TTD: Pengirim, Petugas Gudang, Pengawas Gudang)
  const [openBastModal, setOpenBastModal] = useState(false);
  const [openConfirmSaveModal, setOpenConfirmSaveModal] = useState(false);
  const [isBatchSaved, setIsBatchSaved] = useState(false);
  const [bastSignTab, setBastSignTab] = useState<"pengirim" | "petugas" | "pengawas">("pengirim");
  const [bastSenderName, setBastSenderName] = useState("");
  const [bastSenderSignature, setBastSenderSignature] = useState<string | null>(null);

  // Filter state (default: bulan & tahun sekarang)
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(() => String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(() => String(new Date().getFullYear()));
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
  const [customPengawasName, setCustomPengawasName] = useState(
    DEFAULT_PENGAWAS_GUDANG.name || "ALVIZAN Z., S.H."
  );
  const [customPengawasNip, setCustomPengawasNip] = useState(
    DEFAULT_PENGAWAS_GUDANG.nip || "197312301998031003"
  );
  const [petugasSignature, setPetugasSignature] = useState<string | null>(null);
  const [pengawasSignature, setPengawasSignature] = useState<string | null>(null);
  const [activeSignTab, setActiveSignTab] = useState<"pengirim" | "petugas" | "pengawas">("pengirim");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
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

  // Hitung otomatis displayId berformat BMS-YYYYMMDD-XXXX (reset ke 0001 tiap ganti tanggal)
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
        displayId: `BMS-${ymd}-${String(seq).padStart(4, "0")}`,
      };
    });
  }, [logs]);

  // Filtered logs
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
          log.source.toLowerCase().includes(q) ||
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
    if (filterMonth !== "all") {
      return `Bulan ${MONTH_NAMES[Number(filterMonth) - 1]}`;
    }
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
          type: "in",
          lokasi: locationSlug,
          bulan: filterMonth,
          tahun: filterYear,
          search: search.trim() || undefined,
          pengirim:
            bastSenderName.trim() ||
            filteredLogs.find((l) => l.sender?.trim() && l.sender.trim() !== "-")?.sender ||
            "................................",
          pengirimSignatureDataUrl: bastSenderSignature,
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

  function buildCurrentFormItem(): DraftInboundItem {
    const selectedMaster = items.find((i) => i.id === selectedItemId);
    const itemName =
      mode === "existing"
        ? (selectedMaster?.name ?? "Barang")
        : (newItemName.trim() || "Barang Baru");
    const categoryName =
      mode === "existing"
        ? (selectedMaster?.categoryName ?? "-")
        : (categories.find((c) => c.id === newItemCategory)?.name ?? "-");

    return {
      id: `draft-${Date.now()}`,
      mode,
      itemId: selectedItemId,
      itemName,
      categoryId: newItemCategory,
      categoryName,
      qty: Math.max(1, qty),
      notes: notes.trim(),
      qrCodes: previewQrs.map((q) => q.code),
    };
  }

  function getEffectiveFormItems(): DraftInboundItem[] {
    if (draftItems.length > 0) return draftItems;
    return [buildCurrentFormItem()];
  }

  function handleResetFormBatch() {
    setIsBatchSaved(false);
    setDraftItems([]);
    setPreviewQrs([]);
    setFeedback(null);
    setQty(1);
    setNotes("");
    setIsCustomNoRef(false);
    setNoRef(generateAutoDocNo(inDate, "M", logs));
    if (mode === "new") setNewItemName("");
  }

  function handleAddDraftItem() {
    if (mode === "new" && !newItemName.trim()) {
      setFeedback({ type: "error", text: "Nama barang baru wajib diisi sebelum ditambahkan ke daftar." });
      return;
    }
    setFeedback(null);
    const entry = buildCurrentFormItem();
    const codeSlug = entry.itemName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    const locPrefix = (locationSlug || "SAR").toUpperCase();
    if (entry.qrCodes.length === 0) {
      entry.qrCodes = Array.from({ length: entry.qty }, (_, i) =>
        `SAR-${locPrefix}-${codeSlug}-${String(i + 1).padStart(4, "0")}`
      );
    }
    if (isBatchSaved) {
      setIsBatchSaved(false);
      setDraftItems([entry]);
      setPreviewQrs([]);
    } else {
      setDraftItems((prev) => [...prev, entry]);
    }
    setQty(1);
    setNotes("");
    if (mode === "new") setNewItemName("");
  }

  function handleRemoveDraftItem(id: string) {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleOpenBastModal() {
    setBastSenderName(sender.trim() || "");
    if (recipient) {
      const matchedStaff = staffRoster.find((s) => s.name === recipient);
      if (matchedStaff) {
        setSelectedStaffNip(matchedStaff.nip);
        setCustomSignerName(matchedStaff.name);
        setCustomSignerNip(matchedStaff.nip);
      } else {
        setCustomSignerName(recipient);
      }
    }
    setOpenBastModal(true);
  }

  async function handleConfirmBastPrint() {
    let finalPetugasName = customSignerName.trim();
    let finalPetugasNip = customSignerNip.trim();

    if (!finalPetugasName) {
      const staff = staffRoster.find((s) => s.nip === selectedStaffNip);
      finalPetugasName = staff ? staff.name : (recipient || staffRoster[0]?.name || "Petugas Gudang SAR");
      finalPetugasNip = staff ? staff.nip : (staffRoster[0]?.nip ?? "");
    }

    const finalPengawasName = customPengawasName.trim() || DEFAULT_PENGAWAS_GUDANG.name;
    const finalPengawasNip = customPengawasNip.trim() || DEFAULT_PENGAWAS_GUDANG.nip;
    const activeItems = getEffectiveFormItems();
    const locPrefix = (locationSlug || "SAR").toUpperCase();

    const customRows = activeItems.map((it, idx) => {
      const codeSlug = it.itemName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      const qrs =
        it.qrCodes.length > 0
          ? it.qrCodes
          : Array.from({ length: it.qty }, (_, i) =>
              `SAR-${locPrefix}-${codeSlug}-${String(i + 1).padStart(4, "0")}`
            );

      return {
        id: it.id || String(idx + 1),
        date: inDate,
        noRef: noRef.trim() || "-",
        itemName: it.itemName,
        category: it.categoryName || "-",
        qty: it.qty,
        sourceOrReason: source,
        sender: bastSenderName.trim() || sender.trim() || "-",
        recipient: finalPetugasName,
        notes: it.notes,
        qrCodes: qrs,
      };
    });

    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/admin/inventory-report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "in",
          lokasi: locationSlug,
          customTitle: "BERITA ACARA SERAH TERIMA BARANG MASUK",
          customDocNumber: noRef.trim() || undefined,
          customPeriodLabel: formatTanggalID(inDate),
          customRows,
          pengirim: bastSenderName.trim() || sender.trim() || "................................",
          pengirimSignatureDataUrl: bastSenderSignature,
          petugas: finalPetugasName,
          nip: finalPetugasNip,
          pengawas: finalPengawasName,
          pengawasNip: finalPengawasNip,
          petugasSignatureDataUrl: petugasSignature,
          pengawasSignatureDataUrl: pengawasSignature,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal membuat file PDF surat penerimaan");
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

  async function generatePreview() {
    const activeItems = getEffectiveFormItems();
    const locPrefix = (locationSlug || "SAR").toUpperCase();
    const generated: { code: string; url: string }[] = [];

    for (const entry of activeItems) {
      const codeSlug = entry.itemName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      for (let i = 1; i <= entry.qty; i++) {
        const code = `SAR-${locPrefix}-${codeSlug}-${String(i).padStart(4, "0")}`;
        const url = await QRCode.toDataURL(code, { width: 160, margin: 1 });
        generated.push({ code, url });
      }
    }
    setPreviewQrs(generated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBatchSaved) return;
    setFeedback(null);

    if (!inDate) {
      setFeedback({ type: "error", text: "Tanggal masuk wajib diisi." });
      return;
    }

    if (draftItems.length === 0) {
      if (mode === "new" && !newItemName.trim()) {
        setFeedback({ type: "error", text: "Nama barang baru wajib diisi." });
        return;
      }
      if (mode === "existing" && !selectedItemId) {
        setFeedback({ type: "error", text: "Silakan pilih master barang." });
        return;
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 200) {
        setFeedback({ type: "error", text: "Jumlah unit harus antara 1 sampai 200." });
        return;
      }
    }

    setOpenConfirmSaveModal(true);
  }

  function handleConfirmSubmit() {
    setOpenConfirmSaveModal(false);
    setFeedback(null);

    const itemsToSubmit = getEffectiveFormItems();

    startTransition(async () => {
      const allPreviewList: { code: string; url: string }[] = [];
      const newLogsBatch: InLog[] = [];
      const updatedDrafts: DraftInboundItem[] = [];

      for (const entry of itemsToSubmit) {
        const formData = new FormData();
        formData.set("locationId", locationId);
        formData.set("mode", entry.mode);
        formData.set("itemId", entry.itemId);
        formData.set("newItemName", entry.itemName);
        formData.set("newItemCategory", entry.categoryId);
        formData.set("date", inDate);
        formData.set("quantity", String(entry.qty));
        formData.set("source", source);
        formData.set("referenceNo", noRef);
        formData.set("recipient", recipient);
        formData.set("sender", sender);
        formData.set("notes", entry.notes);

        const res = await submitBarangMasukAction(formData);
        if (res.error) {
          setFeedback({ type: "error", text: res.error });
          return;
        }

        const codes = res.generatedCodes ?? [];
        for (const code of codes) {
          const url = await QRCode.toDataURL(code, { width: 160, margin: 1 });
          allPreviewList.push({ code, url });
        }

        const resolvedName = res.item?.name ?? entry.itemName;
        const resolvedCat = res.item?.categoryName ?? entry.categoryName;

        newLogsBatch.push({
          id: codes[0]?.slice(-8) || `NEW-${Date.now()}`,
          date: inDate,
          noRef: noRef || "-",
          itemName: resolvedName,
          category: resolvedCat,
          qty: entry.qty,
          qrCodes: codes,
          source,
          recipient,
          sender,
          notes: entry.notes,
        });

        updatedDrafts.push({
          ...entry,
          itemName: resolvedName,
          categoryName: resolvedCat,
          qrCodes: codes,
        });

        if (res.item) {
          setItems((prev) => {
            if (prev.some((it) => it.id === res.item!.id)) return prev;
            return [...prev, res.item!].sort((a, b) => a.name.localeCompare(b.name));
          });
          setSelectedItemId(res.item.id);
        }
      }

      if (allPreviewList.length > 0) {
        setPreviewQrs(allPreviewList);
      }
      if (newLogsBatch.length > 0) {
        setLogs((prev) => [...newLogsBatch, ...prev]);
      }
      if (draftItems.length > 0) {
        setDraftItems(updatedDrafts);
      }
      setIsBatchSaved(true);

      setFeedback({
        type: "success",
        text: `${itemsToSubmit.length} jenis barang masuk dan unit QR berhasil disimpan di database. Tombol simpan dikunci agar tidak double input — silakan klik "Cetak Surat Penerimaan" atau "Input Penerimaan Baru".`,
      });
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
                  required={draftItems.length === 0}
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
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setInDate(nextDate);
                  if (!isCustomNoRef && !isBatchSaved) {
                    setNoRef(generateAutoDocNo(nextDate, "M", logs));
                  }
                }}
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-zinc-400">No. BAST / Dokumen</label>
                {isCustomNoRef && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomNoRef(false);
                      setNoRef(generateAutoDocNo(inDate, "M", logs));
                    }}
                    className="text-[10px] text-orange-400 hover:underline"
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
                placeholder="01/M/PL.11.10/I/GDG SAR PDG-2026"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-orange-500"
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-zinc-400">Catatan Tambahan</label>
              <button
                type="button"
                onClick={handleAddDraftItem}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-orange-400 hover:text-orange-300 px-2.5 py-1 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Barang ke Daftar Surat
              </button>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keterangan kelengkapan atau serial number..."
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {draftItems.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                <span className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>
                    Daftar Barang Masuk ({draftItems.length} jenis ·{" "}
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
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-900/60">
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
              onClick={generatePreview}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 text-sm font-medium transition-colors"
            >
              <QrCode className="w-4 h-4 text-orange-400" />
              Generate QR Tag
            </button>
            <button
              type="button"
              onClick={handleOpenBastModal}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 px-4 py-2 text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              Cetak Surat Penerimaan
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
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Input Penerimaan Baru
                </button>
              </div>
            ) : (
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
            )}
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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari barang / BAST / sumber / QR..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setCurrentPage(1);
                }}
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
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-zinc-500 text-sm">
                      Tidak ada riwayat transaksi barang masuk yang sesuai filter.
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

      {/* Modal Konfirmasi Simpan Penerimaan Barang (Ya / Tidak) */}
      <Modal
        open={openConfirmSaveModal}
        onClose={() => setOpenConfirmSaveModal(false)}
        title="Konfirmasi Simpan Penerimaan"
        titleIcon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <p className="text-sm text-zinc-200">
            Apakah Anda yakin ingin menyimpan penerimaan barang ini ke database?
          </p>

          {(() => {
            const duplicates = getEffectiveFormItems().filter((it) =>
              logs.some(
                (l) =>
                  l.date === inDate &&
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
              <span className="text-zinc-400">Tanggal Masuk:</span>
              <strong className="text-white">{formatTanggalID(inDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Sumber Pengadaan:</span>
              <span className="text-zinc-200">{source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Penerima / Pengirim:</span>
              <span className="text-zinc-200">
                {recipient || "-"} / {sender.trim() || "-"}
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
                    <strong className="text-emerald-400 shrink-0 ml-2">{it.qty} unit</strong>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ya, Simpan Barang</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Cetak Surat Penerimaan Barang (BAST) dari Form - 3 TTD */}
      <Modal
        open={openBastModal}
        onClose={() => setOpenBastModal(false)}
        title="Cetak Surat Penerimaan Barang Masuk"
        titleIcon={<Printer className="w-5 h-5 text-orange-400" />}
      >
        <div className="space-y-4 p-4 text-xs">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Tanggal Masuk:</span>
              <strong className="text-white">{formatTanggalID(inDate)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">No. BAST / Dokumen:</span>
              <span className="text-zinc-200 font-mono">{noRef.trim() || "Otomatis"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Sumber Pengadaan:</span>
              <span className="text-zinc-200">{source}</span>
            </div>
            <div className="pt-1.5 border-t border-zinc-800/80">
              <p className="text-zinc-400 mb-1">Isi Tabel Barang Masuk:</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {getEffectiveFormItems().map((it, idx) => (
                  <div key={it.id} className="flex justify-between text-zinc-200">
                    <span className="truncate">
                      {idx + 1}. {it.itemName} ({it.categoryName})
                    </span>
                    <strong className="text-emerald-400 shrink-0 ml-2">{it.qty} unit</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Tab Pilihan Penandatangan: Pengirim, Petugas Gudang, Pengawas Gudang */}
          <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setBastSignTab("pengirim")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                bastSignTab === "pengirim"
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengirim {bastSenderSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setBastSignTab("petugas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                bastSignTab === "petugas"
                  ? "bg-orange-600 text-white"
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
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengawas Gudang {pengawasSignature ? "✓" : ""}
            </button>
          </div>

          {bastSignTab === "pengirim" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Nama Pengirim / Pihak Penyerah
                </label>
                <input
                  value={bastSenderName}
                  onChange={(e) => setBastSenderName(e.target.value)}
                  placeholder="Nama Lengkap Pengirim / Pihak Penyerah"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Pengirim (Opsional)"
                  initialDataUrl={bastSenderSignature}
                  onDataUrlChange={setBastSenderSignature}
                />
              </div>
            </div>
          ) : bastSignTab === "petugas" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Petugas Gudang / Penerima
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Pengawas Gudang</label>
                  <input
                    value={customPengawasNip}
                    onChange={(e) => setCustomPengawasNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
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

          {/* Tab Pilihan Penandatangan */}
          <div className="flex gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveSignTab("pengirim")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeSignTab === "pengirim"
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengirim {bastSenderSignature ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveSignTab("petugas")}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                activeSignTab === "petugas"
                  ? "bg-orange-600 text-white"
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
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengawas Gudang {pengawasSignature ? "✓" : ""}
            </button>
          </div>

          {activeSignTab === "pengirim" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Nama Pengirim / Pihak Penyerah
                </label>
                <input
                  value={bastSenderName}
                  onChange={(e) => setBastSenderName(e.target.value)}
                  placeholder="Nama Lengkap Pengirim (Kosongkan untuk ambil dari riwayat)"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div className="pt-1">
                <SignaturePad
                  label="Tanda Tangan Pengirim (Opsional)"
                  initialDataUrl={bastSenderSignature}
                  onDataUrlChange={setBastSenderSignature}
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
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">NIP Pengawas Gudang</label>
                  <input
                    value={customPengawasNip}
                    onChange={(e) => setCustomPengawasNip(e.target.value)}
                    placeholder="NIP. ..."
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
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
