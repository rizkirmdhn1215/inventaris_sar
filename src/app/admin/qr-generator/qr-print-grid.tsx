"use client";

import { QR_LABELS_PER_PAGE, type QrLabelEntry } from "./constants";

export function chunkLabels<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

type QrPrintGridProps = {
  labels: QrLabelEntry[];
  images: Record<string, string>;
  printRootClass?: string;
  screenGridClass?: string;
  emptyMessage?: string;
};

export function QrPrintGrid({
  labels,
  images,
  printRootClass = "qr-print-root",
  screenGridClass = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3",
  emptyMessage = "Belum ada label.",
}: QrPrintGridProps) {
  const pages = chunkLabels(labels, QR_LABELS_PER_PAGE);

  if (labels.length === 0) {
    return <p className="text-sm text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <>
      <div className={`${printRootClass} hidden print:block`}>
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="qr-print-page">
            {page.map((entry) => (
              <div key={entry.qrCode} className="print-label">
                {images[entry.qrCode] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[entry.qrCode]} alt={entry.qrCode} />
                ) : (
                  <div className="w-[28mm] h-[28mm] bg-zinc-200" />
                )}
                <p className="print-item-name">{entry.itemName}</p>
                <p className="print-qr-code">{entry.qrCode}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={`${screenGridClass} print:hidden`}>
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
    </>
  );
}

export function pageCountForLabels(count: number) {
  if (count <= 0) return 0;
  return Math.ceil(count / QR_LABELS_PER_PAGE);
}
