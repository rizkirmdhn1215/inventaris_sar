"use client";

import { useState } from "react";
import { AppBrand } from "@/components/app-logo";
import { QrCreateTab } from "./qr-create-tab";
import { QrPrintTab, type CatalogItem } from "./qr-print-tab";

type Category = { id: string; name: string };

type TabId = "create" | "print";

export function QrGeneratorClient({
  locationId,
  locationName,
  categories,
  catalog,
}: {
  locationId: string;
  locationName: string;
  categories: Category[];
  catalog: CatalogItem[];
}) {
  const [tab, setTab] = useState<TabId>("print");

  return (
    <div className="space-y-6">
      <AppBrand
        size="md"
        title="QR Generator"
        subtitle={`Minang Rescue · ${locationName}`}
      />

      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1 print:hidden">
        <button
          type="button"
          onClick={() => setTab("print")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === "print"
              ? "bg-orange-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Cetak QR Existing
        </button>
        <button
          type="button"
          onClick={() => setTab("create")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            tab === "create"
              ? "bg-orange-600 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Buat Unit Baru
        </button>
      </div>

      {tab === "print" ? (
        <QrPrintTab catalog={catalog} />
      ) : (
        <QrCreateTab locationId={locationId} categories={categories} />
      )}
    </div>
  );
}
