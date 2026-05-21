"use client";

import { QR_LABELS_PER_PAGE, type QrLabelEntry } from "./constants";

type QrPrintGridProps = {
  labels: QrLabelEntry[];
  images: Record<string, string>;
  screenGridClass?: string;
  emptyMessage?: string;
};

/** On-screen preview only; use printQrLabelSheet() to print. */
export function QrPrintGrid({
  labels,
  images,
  screenGridClass = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3",
  emptyMessage = "Belum ada label.",
}: QrPrintGridProps) {
  if (labels.length === 0) {
    return <p className="text-sm text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <div className={screenGridClass}>
      {labels.map((entry) => (
        <div
          key={entry.qrCode}
          className="border border-zinc-700 rounded-xl bg-white text-black p-2 text-center"
        >
          {images[entry.qrCode] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[entry.qrCode]}
              alt={entry.qrCode}
              className="mx-auto w-[100px] h-[100px]"
            />
          ) : (
            <div className="w-[100px] h-[100px] mx-auto bg-zinc-200 animate-pulse" />
          )}
          <p className="text-[11px] mt-1 font-semibold truncate">{entry.itemName}</p>
          <p className="text-[10px] font-mono text-zinc-600">{entry.qrCode}</p>
        </div>
      ))}
    </div>
  );
}

export function pageCountForLabels(count: number) {
  if (count <= 0) return 0;
  return Math.ceil(count / QR_LABELS_PER_PAGE);
}
