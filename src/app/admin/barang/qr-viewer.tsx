"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Printer } from "lucide-react";

type QrViewerButtonProps = {
  qrCode: string;
  itemName: string;
};

export function QrViewerButton({ qrCode, itemName }: QrViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(qrCode, { width: 320, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, qrCode]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function printQr() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    w.document.write(`
      <html><head><title>${qrCode}</title>
      <style>
        @page { size: 50mm 60mm; margin: 2mm; }
        body { margin: 0; font-family: system-ui, sans-serif; text-align: center; }
        img { width: 36mm; height: 36mm; display: block; margin: 4mm auto 2mm; }
        .name { font-size: 10pt; font-weight: 700; }
        .code { font-size: 8pt; font-family: monospace; margin-top: 1mm; }
      </style></head>
      <body>
        <img src="${dataUrl}" alt="" />
        <div class="name">${itemName}</div>
        <div class="code">${qrCode}</div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-orange-400 hover:text-orange-300"
      >
        Lihat
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-semibold text-white mb-1">{itemName}</h3>
            <p className="text-xs text-zinc-400 font-mono mb-4">{qrCode}</p>

            <div className="bg-white rounded-xl p-4 inline-block">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={qrCode}
                  className="w-[240px] h-[240px] mx-auto block"
                />
              ) : (
                <div className="w-[240px] h-[240px] bg-zinc-200 animate-pulse" />
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <a
                href={dataUrl ?? "#"}
                download={`${qrCode}.png`}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 px-3 py-2 text-xs text-zinc-100 ${
                  dataUrl ? "" : "pointer-events-none opacity-50"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={printQr}
                disabled={!dataUrl}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 px-3 py-2 text-xs text-white"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
