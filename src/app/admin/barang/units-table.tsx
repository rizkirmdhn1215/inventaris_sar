"use client";

import { useState } from "react";
import { Package, Eye, Pencil } from "lucide-react";
import { STATUS_COLOR } from "@/lib/format";
import { UnitConditionSelect } from "./unit-condition-select";
import {
  UnitViewDialog,
  UnitEditDialog,
  getCleanNotes,
  type UnitDetailData,
} from "./unit-detail-modal";
import { QrDialog } from "./qr-viewer";

export type UnitTableItem = {
  id: string;
  qrCode: string;
  status: string;
  condition: string;
  notes: string | null;
  item: {
    name: string;
    merk?: string | null;
    category?: { name: string } | null;
  };
  conditionReports: {
    conditionResult: string;
    damageDescription: string | null;
    severity: string | null;
    photoUrls: string[];
    createdAt: Date | string;
    returnCheck: {
      checkedBy: string;
      loan: {
        borrowerName: string;
        borrowerDivision: string;
        purpose: string;
      };
    };
  }[];
};

export function UnitsTable({
  units,
  startIndex,
}: {
  units: UnitTableItem[];
  startIndex: number;
}) {
  const [activeQr, setActiveQr] = useState<{ qrCode: string; itemName: string } | null>(null);
  const [activeView, setActiveView] = useState<UnitDetailData | null>(null);
  const [activeEdit, setActiveEdit] = useState<UnitDetailData | null>(null);

  const toDetailData = (unit: UnitTableItem): UnitDetailData => ({
    id: unit.id,
    qrCode: unit.qrCode,
    status: unit.status,
    condition: unit.condition,
    notes: unit.notes,
    itemName: unit.item.name,
    categoryName: unit.item.category?.name ?? null,
    merk: unit.item.merk ?? null,
    latestReport: unit.conditionReports[0]
      ? {
          conditionResult: unit.conditionReports[0].conditionResult,
          damageDescription: unit.conditionReports[0].damageDescription,
          severity: unit.conditionReports[0].severity,
          photoUrls: unit.conditionReports[0].photoUrls,
          createdAt: unit.conditionReports[0].createdAt,
          checkedBy: unit.conditionReports[0].returnCheck.checkedBy,
          borrowerName: unit.conditionReports[0].returnCheck.loan.borrowerName,
          purpose: unit.conditionReports[0].returnCheck.loan.purpose,
        }
      : null,
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400 w-12">No</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Barang</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kategori</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">QR Code</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Kondisi</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit, idx) => {
              const cleanNotes = getCleanNotes(unit.notes);
              const isProblematic =
                unit.status === "maintenance" ||
                unit.status === "damaged" ||
                unit.status === "lost" ||
                unit.condition === "damaged" ||
                unit.condition === "lost" ||
                Boolean(cleanNotes) ||
                unit.conditionReports.length > 0;

              return (
                <tr
                  key={unit.id}
                  className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-900/30 transition-colors"
                >
                  <td className="px-4 py-2 text-zinc-400 text-xs">
                    {startIndex + idx}
                  </td>
                  <td className="px-4 py-2 text-zinc-100">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-zinc-500" />
                      <span>{unit.item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{unit.item.category?.name ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-300 font-mono text-xs">{unit.qrCode}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ${
                        STATUS_COLOR[unit.status] ?? "bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <UnitConditionSelect
                      key={`${unit.id}-${unit.status}-${unit.condition}`}
                      unitId={unit.id}
                      initialCondition={
                        unit.status === "maintenance" ? "maintenance" : unit.condition
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveQr({ qrCode: unit.qrCode, itemName: unit.item.name })
                        }
                        className="text-xs text-orange-400 hover:text-orange-300 font-medium px-1.5 py-1"
                      >
                        Lihat
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView(toDetailData(unit))}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isProblematic
                            ? "border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60"
                            : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                        title="Lihat Detail Unit"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveEdit(toDetailData(unit))}
                        className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Edit Kondisi & Catatan Unit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Controller Tunggal: Hanya mount 1 modal saat tombol diklik */}
      {activeQr && (
        <QrDialog
          qrCode={activeQr.qrCode}
          itemName={activeQr.itemName}
          onClose={() => setActiveQr(null)}
        />
      )}
      {activeView && (
        <UnitViewDialog unit={activeView} onClose={() => setActiveView(null)} />
      )}
      {activeEdit && (
        <UnitEditDialog unit={activeEdit} onClose={() => setActiveEdit(null)} />
      )}
    </>
  );
}
