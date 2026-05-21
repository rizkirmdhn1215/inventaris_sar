import { chunkLabels, QR_LABELS_PER_PAGE, type QrLabelEntry } from "./constants";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Opens a minimal print-only window with QR sticker pages (18 per A4).
 * Avoids admin layout / print:hidden ancestors that cause blank pages.
 */
export function printQrLabelSheet(
  labels: QrLabelEntry[],
  images: Record<string, string>
): boolean {
  if (labels.length === 0) return false;

  const missing = labels.filter((l) => !images[l.qrCode]);
  if (missing.length > 0) {
    window.alert("QR masih dimuat. Tunggu sebentar lalu coba cetak lagi.");
    return false;
  }

  const pages = chunkLabels(labels, QR_LABELS_PER_PAGE);
  const pagesHtml = pages
    .map((page) => {
      const cells = page
        .map((label) => {
          const src = images[label.qrCode];
          return `<div class="label">
            <img src="${src}" alt="" />
            <div class="name">${escapeHtml(label.itemName)}</div>
            <div class="code">${escapeHtml(label.qrCode)}</div>
          </div>`;
        })
        .join("");
      return `<div class="page">${cells}</div>`;
    })
    .join("");

  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.");
    return false;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Cetak QR (${labels.length} label)</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; color: #000; background: #fff; }
    .page {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(6, 1fr);
      width: 194mm;
      height: 281mm;
      gap: 2mm;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .label {
      border: 0.3mm solid #000;
      border-radius: 2mm;
      padding: 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label img { width: 28mm; height: 28mm; object-fit: contain; display: block; }
    .name {
      font-size: 8pt;
      font-weight: 700;
      margin-top: 1mm;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .code { font-size: 7pt; font-family: ui-monospace, monospace; margin-top: 0.5mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    (function () {
      function done() {
        window.focus();
        window.print();
        setTimeout(function () { window.close(); }, 600);
      }
      var imgs = document.images;
      if (!imgs.length) { done(); return; }
      var left = imgs.length;
      function tick() {
        if (--left <= 0) done();
      }
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) tick();
        else {
          imgs[i].onload = tick;
          imgs[i].onerror = tick;
        }
      }
    })();
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
