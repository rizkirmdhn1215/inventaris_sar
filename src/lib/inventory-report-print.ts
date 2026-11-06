
import { formatTanggalID } from "@/lib/format";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";

export type InventoryReportRow = {
  id: string;
  displayId?: string;
  date: string;
  noRef: string;
  itemName: string;
  category: string;
  qty: number;
  sourceOrReason: string;
  recipientOrTarget?: string;
  sender?: string;
  recipient?: string;
  target?: string;
  notes?: string;
  qrCodes: string[];
};

function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined || text === "") return "-";

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Mencetak laporan barang masuk atau barang keluar.
 * Format: A4 Portrait, mengikuti susunan surat peminjaman.
 */
export function printInventoryReport(options: {
  title: string;
  type: "in" | "out";
  locationName: string;
  periodLabel: string;
  rows: InventoryReportRow[];
  totalQty: number;
  signerName?: string;
  signerNip?: string;
}): boolean {
  if (typeof window === "undefined") return false;

  const currentDateFormatted = formatTanggalID(new Date());

  const isIncoming = options.type === "in";
  const typeText = isIncoming ? "BARANG MASUK" : "BARANG KELUAR";
  const period = (options.periodLabel || "").trim();

  // Judul dokumen dinamis mengikuti periode bulan/tahun/operasional
  let suratTitle = `SURAT LAPORAN ${typeText}`;
  if (!period || period.toLowerCase() === "semua periode") {
    suratTitle = `SURAT LAPORAN ${typeText} OPERASIONAL`;
  } else if (period.toLowerCase().startsWith("bulan ")) {
    suratTitle = `SURAT LAPORAN ${typeText} ${period.toUpperCase()}`;
  } else if (period.toLowerCase().startsWith("tahun ")) {
    suratTitle = `SURAT LAPORAN ${typeText} ${period.toUpperCase()}`;
  } else {
    suratTitle = `SURAT LAPORAN ${typeText} BULAN ${period.toUpperCase()}`;
  }

  const totalTransactions = options.rows.length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const yearNow = new Date().getFullYear();
  const monthNow = String(new Date().getMonth() + 1).padStart(2, "0");
  const docNumber = `SAR/LOG/${isIncoming ? "BM" : "BK"}/${yearNow}/${monthNow}`;

  const rowsHtml = options.rows
    .map((row, idx) => {
      const qrCodes =
        row.qrCodes && row.qrCodes.length > 0
          ? row.qrCodes.join(", ")
          : "-";

      return `
        <tr>
          <td class="center number">${idx + 1}</td>
          <td class="date-cell">
            ${escapeHtml(row.date)}
          </td>
          <td class="ref-cell font-mono">
            ${escapeHtml(row.noRef)}
          </td>
          <td class="item-cell">
            <strong>${escapeHtml(row.itemName)}</strong>
          </td>
          <td class="cat-cell">
            ${escapeHtml(row.category)}
          </td>
          <td class="center quantity">
            <strong>${escapeHtml(row.qty)}</strong>
          </td>
          <td class="source-cell">
            ${escapeHtml(row.sourceOrReason)}
            ${
              row.notes
                ? `<div class="sub-text">Ket: ${escapeHtml(row.notes)}</div>`
                : ""
            }
          </td>
          ${
            isIncoming
              ? `
                <td class="person-cell">${escapeHtml(row.sender || "-")}</td>
                <td class="person-cell">${escapeHtml(row.recipient || "-")}</td>
              `
              : `
                <td class="person-cell">${escapeHtml(row.recipient || "-")}</td>
                <td class="person-cell">${escapeHtml(row.target || "-")}</td>
              `
          }
          <td class="qr-cell">
            ${escapeHtml(qrCodes)}
          </td>
        </tr>
      `;
    })
    .join("");

  const emptyRow = `
    <tr>
      <td colspan="10" class="empty-row">
        Tidak ada transaksi pada periode ini.
      </td>
    </tr>
  `;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- Title sengaja dikosongkan agar browser tidak mencetak judul URL / about:blank di header print -->
  <title></title>

  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #e2e8f0;
      color: #0a0a0a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }

    /* Screen Preview: Tampilan Lembar A4 Portrait */
    .screen-container {
      padding: 24px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }

    .no-print-toolbar {
      width: 210mm;
      max-width: 100%;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toolbar-info {
      font-size: 11px;
      color: #475569;
      font-weight: 500;
    }

    .document {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      margin: 0 auto;
      padding: 16mm 14mm 18mm 14mm;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      border-radius: 2px;
      position: relative;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    /* KOP SURAT */
    .kop-wrapper {
      width: 100%;
      margin-bottom: 14px;
      border-bottom: 2.5px solid #0a0a0a;
      padding-bottom: 8px;
    }

    .kop-img {
      width: 100%;
      height: auto;
      max-height: 145px;
      object-fit: fill;
      display: block;
    }

    .text-kop {
      text-align: center;
      padding-bottom: 8px;
    }

    .text-kop h2 {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }

    .text-kop h3 {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 3px 0;
    }

    .text-kop p {
      font-size: 10px;
      color: #333333;
      margin: 3px 0 0;
    }

    /* JUDUL SURAT */
    .title-section {
      text-align: center;
      margin: 12px 0 14px;
    }

    .title-section h3 {
      display: inline-block;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: underline;
      text-underline-offset: 3px;
      margin: 0;
    }

    .title-section p {
      font-size: 10px;
      margin: 4px 0 0;
      color: #171717;
    }

    .paragraph {
      margin-bottom: 8px;
      line-height: 1.5;
      text-align: justify;
      font-size: 11px;
    }

    /* INFORMASI METADATA (Format Surat Peminjaman) */
    .info-table {
      margin: 8px 0 12px;
    }

    .info-row {
      display: flex;
      margin-bottom: 3.5px;
      font-size: 11px;
    }

    .info-label {
      width: 120px;
      flex-shrink: 0;
      color: #171717;
    }

    .info-colon {
      width: 15px;
      flex-shrink: 0;
    }

    .info-val {
      flex: 1;
      font-weight: normal;
    }

    /* TABEL DAFTAR BARANG */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 6px;
      margin-bottom: 14px;
      border: 1px solid #262626;
    }

    th, td {
      border: 1px solid #262626;
      padding: 5px 4px;
      vertical-align: middle;
      font-size: 9.5px;
      overflow-wrap: anywhere;
    }

    th {
      text-align: center;
      font-weight: bold;
      background: #f4f4f5;
      font-size: 9.5px;
    }

    .center {
      text-align: center;
    }

    .number {
      width: 30px;
      text-align: center;
    }

    .date-cell {
      width: 75px;
      text-align: center;
    }

    .ref-cell {
      width: 80px;
      font-size: 8px;
    }

    .item-cell {
      width: auto;
    }

    .cat-cell {
      width: 65px;
    }

    .quantity {
      width: 45px;
      text-align: center;
    }

    .source-cell {
      width: 90px;
    }

    .person-cell {
      width: 75px;
      font-size: 8.5px;
    }

    .qr-cell {
      width: 85px;
      font-family: monospace;
      font-size: 7.5px;
      word-break: break-all;
    }

    .font-mono {
      font-family: monospace;
    }

    .sub-text {
      font-size: 8px;
      color: #525252;
      margin-top: 2px;
    }

    .empty-row {
      text-align: center;
      padding: 16px;
      font-style: italic;
      color: #737373;
    }

    /* TANDA TANGAN (HANYA 2 PIHAK: PENGAWAS GUDANG & PETUGAS GUDANG) */
    .sign-group {
      margin-top: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sign-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .sign-box {
      width: 42%;
      text-align: center;
      font-size: 11px;
    }

    .sign-space {
      height: 55px;
    }

    .sign-line {
      display: inline-block;
      width: 85%;
      border-top: 1px solid #0a0a0a;
      padding-top: 3px;
      font-weight: bold;
      font-size: 11px;
    }

    .sign-nip {
      font-size: 9px;
      color: #404040;
      margin-top: 2px;
    }

    /* FOOTER */
    .footer {
      margin-top: auto;
      padding-top: 4px;
      border-top: 0.5px solid #d4d4d4;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #525252;
      position: relative;
      bottom: 0;
    }

    .no-print {
      text-align: right;
      margin-bottom: 12px;
    }

    .print-button {
      padding: 8px 18px;
      border: none;
      border-radius: 6px;
      background: #ea580c;
      color: #ffffff;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(234, 88, 12, 0.35);
      transition: background 0.15s ease;
    }

    .print-button:hover {
      background: #c2410c;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .screen-container {
        padding: 0 !important;
        display: block !important;
        min-height: auto !important;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .document {
        width: 100% !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .footer {
        position: fixed;
        bottom: 8px;
        left: 0;
        right: 0;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>

<body>
  <div class="screen-container">
    <div class="no-print-toolbar">
      <div class="toolbar-info">
        Format Cetak: <strong>A4 Portrait</strong> · Kantor SAR Padang
        <span style="display: block; font-size: 10px; color: #64748b; margin-top: 2px;">
          💡 Hilangkan centang <strong>"Header dan footer"</strong> pada pengaturan cetak browser agar bersih tanpa tulisan about:blank/tanggal bawaan.
        </span>
      </div>
      <button class="print-button" onclick="window.print()">
        🖨️ Cetak / Simpan PDF
      </button>
    </div>

    <main class="document">
      <!-- KOP SURAT RESMI BASARNAS -->
      <header class="kop-wrapper">
      <img
        src="${origin}/kop-surat.png"
        class="kop-img"
        alt="KOP SURAT BASARNAS"
        onerror="this.style.display='none'; document.getElementById('text-kop-fallback').style.display='block';"
      />
      <div id="text-kop-fallback" class="text-kop" style="display: none;">
        <h2>BADAN NASIONAL PENCARIAN DAN PERTOLONGAN</h2>
        <h3>KANTOR PENCARIAN DAN PERTOLONGAN PADANG</h3>
        <p>Jl. By Pass KM 25 Anak Air, Padang 25179, Sumatera Barat</p>
      </div>
    </header>

    <!-- JUDUL LAPORAN DINAMIS SESUAI BULAN / PERIODE -->
    <section class="title-section">
      <h3>${escapeHtml(suratTitle)}</h3>
      <p>Nomor: ${docNumber}</p>
    </section>

    <!-- PENGANTAR -->
    <p class="paragraph">
      Yang bertanda tangan di bawah ini menerangkan bahwa telah dilakukan pencatatan ${isIncoming ? "penerimaan barang masuk" : "pengeluaran barang"} operasional dari gudang Kantor SAR Padang (${escapeHtml(options.locationName)}) dengan rincian sebagai berikut:
    </p>

    <!-- INFORMASI METADATA -->
    <div class="info-table">
      <div class="info-row">
        <div class="info-label">Unit Kerja / Lokasi</div>
        <div class="info-colon">:</div>
        <div class="info-val">Kantor Pencarian dan Pertolongan Padang (${escapeHtml(options.locationName)})</div>
      </div>
      <div class="info-row">
        <div class="info-label">Periode Laporan</div>
        <div class="info-colon">:</div>
        <div class="info-val">${escapeHtml(options.periodLabel)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Total Transaksi</div>
        <div class="info-colon">:</div>
        <div class="info-val">${totalTransactions} Transaksi</div>
      </div>
      <div class="info-row">
        <div class="info-label">Total Barang ${isIncoming ? "Masuk" : "Keluar"}</div>
        <div class="info-colon">:</div>
        <div class="info-val"><strong>${escapeHtml(options.totalQty)} Unit Fisik</strong></div>
      </div>
    </div>

    <!-- TABEL TRANSAKSI -->
    <p class="paragraph" style="margin-top: 10px; font-weight: bold;">
      Daftar rincian transaksi barang ${isIncoming ? "masuk" : "keluar"}:
    </p>

    <table>
      <thead>
        <tr>
          <th class="number">No</th>
          <th class="date-cell">Tanggal</th>
          <th class="ref-cell">No. Dokumen</th>
          <th class="item-cell">Nama Barang</th>
          <th class="cat-cell">Kategori</th>
          <th class="quantity">Jumlah</th>
          <th class="source-cell">${isIncoming ? "Sumber Pengadaan" : "Alasan"}</th>
          ${
            isIncoming
              ? '<th class="person-cell">Nama Pengirim</th><th class="person-cell">Nama Penerima</th>'
              : '<th class="person-cell">Penerima</th><th class="person-cell">Tujuan</th>'
          }
          <th class="qr-cell">Kode QR Unit</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || emptyRow}
      </tbody>
    </table>

    <!-- PENUTUP -->
    <p class="paragraph" style="margin-top: 8px;">
      Demikian surat laporan barang ${isIncoming ? "masuk" : "keluar"} operasional ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
    </p>

    <!-- BLOK TANDA TANGAN (HANYA 2 PIHAK: PENGAWAS GUDANG & PETUGAS GUDANG) -->
    <div class="sign-group">
      <div class="sign-row">
        <!-- Pengawas Gudang (Kiri) -->
        <div class="sign-box">
          <p style="margin: 0;">Mengetahui,</p>
          <p style="margin: 2px 0 0; font-weight: bold;">Pengawas Gudang,</p>
          <div class="sign-space"></div>
          <span class="sign-line">
            ${escapeHtml(DEFAULT_PENGAWAS_GUDANG.name)}
          </span>
          <div class="sign-nip">
            ${DEFAULT_PENGAWAS_GUDANG.nip ? `NIP. ${escapeHtml(DEFAULT_PENGAWAS_GUDANG.nip)}` : "NIP. 12131313133"}
          </div>
        </div>

        <!-- Petugas Gudang (Kanan) -->
        <div class="sign-box">
          <p style="margin: 0;">Padang, ${escapeHtml(currentDateFormatted)}</p>
          <p style="margin: 2px 0 0; font-weight: bold;">Petugas Gudang,</p>
          <div class="sign-space"></div>
          <span class="sign-line">
            ${escapeHtml(options.signerName || "Petugas Gudang SAR")}
          </span>
          <div class="sign-nip">
            ${options.signerNip ? `NIP. ${escapeHtml(options.signerNip)}` : ""}
          </div>
        </div>
      </div>
    </div>

    <!-- FOOTER RESMI PERSIS SURAT PEMINJAMAN -->
    <div class="footer">
      <div>Tanggal cetak: ${escapeHtml(currentDateFormatted)}</div>
      <div>Halaman 1 dari 1</div>
    </div>
  </main>
</div>

  <script>
    window.onbeforeprint = function () {
      document.title = "";
    };
    window.onload = function () {
      document.title = "";
      setTimeout(function () {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, "_blank");

  if (!win) {
    window.alert("Popup browser diblokir. Izinkan popup untuk mencetak laporan.");
    return false;
  }

  return true;
}

/**
 * Export laporan barang masuk / keluar ke CSV.
 * Tetap kompatibel dengan import pada halaman barang-masuk-client.tsx.
 */
export function exportInventoryToCsv(options: {
  filename: string;
  type: "in" | "out";
  rows: InventoryReportRow[];
}): void {
  if (typeof window === "undefined") return;

  const headers =
    options.type === "in"
      ? [
          "No",
          "ID Transaksi",
          "Tanggal",
          "No. Dokumen",
          "Nama Barang",
          "Kategori",
          "Jumlah",
          "Sumber Pengadaan",
          "Catatan",
          "Kode QR Unit",
        ]
      : [
          "No",
          "ID Transaksi",
          "Tanggal",
          "No. Dokumen",
          "Nama Barang",
          "Kategori",
          "Jumlah",
          "Alasan",
          "Penerima/Tujuan",
          "Catatan",
          "Kode QR Unit",
        ];

  const sanitize = (
    value: string | number | undefined | null
  ): string => {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  };

  const csvRows: string[] = [headers.join(",")];

  options.rows.forEach((row, idx) => {
    const transactionId =
      row.displayId || row.id.slice(0, 8).toUpperCase();

    const commonData = [
      idx + 1,
      sanitize(transactionId),
      sanitize(row.date),
      sanitize(row.noRef),
      sanitize(row.itemName),
      sanitize(row.category),
      row.qty,
    ];

    const rowData =
      options.type === "in"
        ? [
            ...commonData,
            sanitize(row.sourceOrReason),
            sanitize(row.notes || ""),
            sanitize((row.qrCodes || []).join("; ")),
          ]
        : [
            ...commonData,
            sanitize(row.sourceOrReason),
            sanitize(row.recipientOrTarget || ""),
            sanitize(row.notes || ""),
            sanitize((row.qrCodes || []).join("; ")),
          ];

    csvRows.push(rowData.join(","));
  });

  const blob = new Blob(
    ["\uFEFF" + csvRows.join("\r\n")],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${options.filename}.csv`;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
