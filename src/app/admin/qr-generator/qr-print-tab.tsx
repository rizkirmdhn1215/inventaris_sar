"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Search, Printer, CheckSquare, Square } from "lucide-react";
import { QR_LABELS_PER_PAGE, type QrLabelEntry } from "./constants";
import { QrPrintGrid, pageCountForLabels } from "./qr-print-grid";
import { printQrLabelSheet } from "./print-qr-sheet";

export type CatalogUnit = {
  unitId: string;
  qrCode: string;
  status: string;
};

export type CatalogItem = {
  itemId: string;
  itemName: string;
  categoryName: string | null;
  units: CatalogUnit[];
};

export function QrPrintTab({ catalog }: { catalog: CatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<Record<string, string>>({});
  const [preparing, setPreparing] = useState(false);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of catalog) {
      if (item.categoryName) names.add(item.categoryName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "id"));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (categoryFilter && item.categoryName !== categoryFilter) return false;
      if (!q) return true;
      if (item.itemName.toLowerCase().includes(q)) return true;
      if (item.categoryName?.toLowerCase().includes(q)) return true;
      return item.units.some((u) => u.qrCode.toLowerCase().includes(q));
    });
  }, [catalog, query, categoryFilter]);

  const selectedLabels: QrLabelEntry[] = useMemo(() => {
    const out: QrLabelEntry[] = [];
    for (const item of catalog) {
      for (const unit of item.units) {
        if (selected.has(unit.unitId)) {
          out.push({ qrCode: unit.qrCode, itemName: item.itemName });
        }
      }
    }
    return out.sort((a, b) => a.qrCode.localeCompare(b.qrCode));
  }, [catalog, selected]);

  useEffect(() => {
    if (selectedLabels.length === 0) {
      setImages({});
      return;
    }

    let cancelled = false;
    setPreparing(true);

    const timer = setTimeout(async () => {
      const entries = await Promise.all(
        selectedLabels.map(async (label) => {
          const dataUrl = await QRCode.toDataURL(label.qrCode, { width: 200, margin: 1 });
          return [label.qrCode, dataUrl] as const;
        })
      );
      if (!cancelled) {
        setImages(Object.fromEntries(entries));
        setPreparing(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedLabels]);

  function toggleUnit(unitId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function toggleItem(item: CatalogItem, select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of item.units) {
        if (select) next.add(u.unitId);
        else next.delete(u.unitId);
      }
      return next;
    });
  }

  function toggleExpand(itemId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const totalUnits = catalog.reduce((n, i) => n + i.units.length, 0);
  const pageCount = pageCountForLabels(selectedLabels.length);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-white">Cetak QR Barang Existing</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Pilih unit dari master barang, lalu cetak stiker. Maks. {QR_LABELS_PER_PAGE} label
            per halaman A4
            {selectedLabels.length > 0 ? ` (${pageCount} halaman untuk pilihan saat ini)` : ""}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama barang atau kode QR..."
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-2 text-sm text-white"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const all = new Set<string>();
              for (const item of filteredCatalog) {
                for (const u of item.units) all.add(u.unitId);
              }
              setSelected(all);
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-600"
          >
            Pilih semua ({filteredCatalog.reduce((n, i) => n + i.units.length, 0)} unit)
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-600"
          >
            Kosongkan
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
          {filteredCatalog.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              {totalUnits === 0
                ? "Belum ada unit. Buat unit baru di tab Buat Unit Baru."
                : "Tidak ada barang sesuai filter."}
            </p>
          ) : (
            filteredCatalog.map((item) => {
              const allSelected = item.units.every((u) => selected.has(u.unitId));
              const someSelected = item.units.some((u) => selected.has(u.unitId));
              const isOpen = expanded.has(item.itemId) || query.trim().length > 0;

              return (
                <div key={item.itemId} className="bg-zinc-950/40">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleItem(item, !allSelected)}
                      className="text-orange-400 shrink-0"
                      title={allSelected ? "Batalkan semua unit" : "Pilih semua unit"}
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square
                          className={`w-4 h-4 ${someSelected ? "text-orange-300" : ""}`}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.itemId)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm text-zinc-100 truncate">{item.itemName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {item.categoryName ?? "-"} · {item.units.length} unit
                      </p>
                    </button>
                  </div>
                  {isOpen ? (
                    <ul className="pb-2 px-3 space-y-1">
                      {item.units.map((unit) => (
                        <li key={unit.unitId}>
                          <label className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-800/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.has(unit.unitId)}
                              onChange={() => toggleUnit(unit.unitId)}
                              className="rounded border-zinc-600"
                            />
                            <span className="font-mono text-xs text-zinc-300">{unit.qrCode}</span>
                            <span className="text-[10px] text-zinc-500 ml-auto">{unit.status}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-400">
            Dipilih: <strong className="text-zinc-200">{selectedLabels.length}</strong> unit ·{" "}
            {pageCount} halaman cetak
            {preparing ? " · menyiapkan QR..." : ""}
          </p>
          <button
            type="button"
            onClick={() => printQrLabelSheet(selectedLabels, images)}
            disabled={selectedLabels.length === 0 || preparing}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
          >
            <Printer className="w-4 h-4" />
            Cetak QR Terpilih
          </button>
        </div>
      </div>

      {selectedLabels.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 className="text-sm font-medium text-white mb-2">
            Preview ({selectedLabels.length} label, {pageCount} halaman @ {QR_LABELS_PER_PAGE}/hal)
          </h3>
          <QrPrintGrid labels={selectedLabels} images={images} />
        </div>
      ) : null}
    </div>
  );
}
