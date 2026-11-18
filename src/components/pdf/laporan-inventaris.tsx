import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import { formatTanggalID } from "@/lib/format";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";

// Matikan auto-hyphenation bawaan agar teks panjang/kode QR tidak terpotong keluar garis tabel
Font.registerHyphenationCallback((word) => [word]);

function formatSingleQr(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length <= 32) return trimmed;
  const match = trimmed.match(/^(SAR-[A-Z0-9]+-[A-Z0-9]+-)(.+)$/i);
  if (match) return `${match[1]}\n${match[2]}`;
  return `${trimmed.slice(0, 28)}\n${trimmed.slice(28)}`;
}

function formatQrCell(qrCodes?: string[]): string {
  if (!qrCodes || qrCodes.length === 0) return "-";
  if (qrCodes.length === 1) return formatSingleQr(qrCodes[0]);
  if (qrCodes.length === 2) {
    return `${formatSingleQr(qrCodes[0])}\n${formatSingleQr(qrCodes[1])}`;
  }
  return `${formatSingleQr(qrCodes[0])}\ns/d\n${formatSingleQr(qrCodes[qrCodes.length - 1])}`;
}

export type LaporanInventarisRow = {
  id: string;
  date: string;
  noRef: string;
  itemName: string;
  category: string;
  qty: number;
  sourceOrReason: string;
  sender?: string;
  recipient?: string;
  target?: string;
  notes?: string;
  qrCodes?: string[];
};

export type LaporanInventarisProps = {
  type: "in" | "out";
  title: string;
  docNumber: string;
  locationName: string;
  periodLabel: string;
  totalTransactions: number;
  totalQty: number;
  rows: LaporanInventarisRow[];
  signerName: string;
  signerNip?: string;
  pengawasName?: string;
  pengawasNip?: string;
  kopImage?: Buffer | null;
  generatedDate?: Date;
  petugasSignatureDataUrl?: string | null;
  pengawasSignatureDataUrl?: string | null;
  senderSignerName?: string;
  senderSignatureDataUrl?: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 48,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#0a0a0a",
  },
  kopImage: {
    width: 595,
    marginLeft: -36,
    marginRight: -36,
    marginTop: -36,
    marginBottom: 12,
  },
  kopFallback: {
    borderBottomWidth: 2,
    borderBottomColor: "#0a0a0a",
    paddingBottom: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  kopTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  kopSub: {
    fontSize: 9,
    color: "#404040",
    marginTop: 2,
  },
  judul: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    marginTop: 6,
    textDecoration: "underline",
    textTransform: "uppercase",
  },
  nomor: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 3,
    marginBottom: 10,
    color: "#262626",
  },
  paragraph: {
    marginBottom: 6,
    lineHeight: 1.4,
    textAlign: "justify",
    fontSize: 9,
  },
  infoSection: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 2.5,
  },
  infoLabel: {
    width: 110,
    color: "#262626",
  },
  infoColon: {
    width: 10,
  },
  infoValue: {
    flex: 1,
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: "#262626",
    marginTop: 6,
    marginBottom: 10,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  trLast: {
    flexDirection: "row",
  },
  th: {
    padding: 3,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#262626",
    fontSize: 7.5,
    textAlign: "center",
    backgroundColor: "#f4f4f5",
  },
  td: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#262626",
    fontSize: 7,
  },
  tdLast: {
    padding: 3,
    fontSize: 7,
  },
  center: {
    textAlign: "center",
  },
  qrText: {
    fontSize: 5.8,
    lineHeight: 1.35,
  },
  emptyRow: {
    padding: 10,
    textAlign: "center",
    fontStyle: "italic",
    color: "#737373",
  },
  signGroup: {
    marginTop: 20,
    fontSize: 10,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signCenterRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  signBox: {
    width: "40%",
    textAlign: "center",
  },
  signHeader: {
    height: 28,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  signSlot: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  signImage: {
    height: 48,
    objectFit: "contain",
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: "#0a0a0a",
    paddingTop: 4,
    fontSize: 10,
  },
  signNip: {
    marginTop: 3,
    fontSize: 8.5,
    color: "#404040",
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4d4",
    paddingTop: 3,
  },
  footerText: {
    fontSize: 7.5,
    color: "#525252",
  },
});

export function LaporanInventarisDocument(props: LaporanInventarisProps) {
  const isIncoming = props.type === "in";
  const dateFormatted = formatTanggalID(props.generatedDate ?? new Date());
  const pengawasName = props.pengawasName || DEFAULT_PENGAWAS_GUDANG.name;
  const pengawasNip = props.pengawasNip || DEFAULT_PENGAWAS_GUDANG.nip;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {props.kopImage ? (
          <Image style={styles.kopImage} src={props.kopImage} />
        ) : (
          <View style={styles.kopFallback}>
            <Text style={styles.kopTitle}>BADAN NASIONAL PENCARIAN DAN PERTOLONGAN</Text>
            <Text style={styles.kopTitle}>KANTOR PENCARIAN DAN PERTOLONGAN PADANG</Text>
            <Text style={styles.kopSub}>Jl. By Pass KM 25 Anak Air, Padang 25179, Sumatera Barat</Text>
          </View>
        )}

        <Text style={styles.judul}>{props.title}</Text>
        <Text style={styles.nomor}>Nomor: {props.docNumber}</Text>

        <Text style={styles.paragraph}>
          Yang bertanda tangan di bawah ini menerangkan bahwa telah dilakukan pencatatan{" "}
          {isIncoming ? "penerimaan barang masuk" : "pengeluaran barang"} operasional dari gudang{" "}
          {props.locationName} dengan rincian sebagai berikut:
        </Text>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Unit Kerja / Lokasi</Text>
            <Text style={styles.infoColon}>:</Text>
            <Text style={styles.infoValue}>{props.locationName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Periode Laporan</Text>
            <Text style={styles.infoColon}>:</Text>
            <Text style={styles.infoValue}>{props.periodLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Transaksi</Text>
            <Text style={styles.infoColon}>:</Text>
            <Text style={styles.infoValue}>{props.totalTransactions} Transaksi</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {isIncoming ? "Total Barang Masuk" : "Total Barang Keluar"}
            </Text>
            <Text style={styles.infoColon}>:</Text>
            <Text style={styles.infoValue}>{props.totalQty} Unit Fisik</Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { fontWeight: 700, marginBottom: 2 }]}>
          Daftar rincian transaksi barang {isIncoming ? "masuk" : "keluar"}:
        </Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "4%" }]}>No</Text>
            <Text style={[styles.th, { width: "15%" }]}>Nama Barang</Text>
            <Text style={[styles.th, { width: "8%" }]}>Kategori</Text>
            <Text style={[styles.th, { width: "5%" }]}>Jml</Text>
            <Text style={[styles.th, { width: "9%" }]}>Tanggal</Text>
            <Text style={[styles.th, { width: "9%" }]}>No. Dokumen</Text>
            <Text style={[styles.th, { width: "10%" }]}>
              {isIncoming ? "Sumber" : "Alasan"}
            </Text>
            <Text style={[styles.th, { width: "9%" }]}>
              {isIncoming ? "Pengirim" : "Penerima"}
            </Text>
            <Text style={[styles.th, { width: "9%" }]}>
              {isIncoming ? "Penerima" : "Tujuan"}
            </Text>
            <Text style={[styles.th, { width: "22%", borderRightWidth: 0 }]}>Kode QR</Text>
          </View>

          {props.rows.length === 0 ? (
            <View style={styles.trLast}>
              <Text style={[styles.emptyRow, { width: "100%" }]}>
                Tidak ada transaksi pada periode ini.
              </Text>
            </View>
          ) : (
            props.rows.map((row, i) => {
              const isLast = i === props.rows.length - 1;
              const qrText = formatQrCell(row.qrCodes);

              return (
                <View key={row.id || i} style={isLast ? styles.trLast : styles.tr} wrap={false}>
                  <Text style={[styles.td, styles.center, { width: "4%" }]}>{i + 1}</Text>
                  <Text style={[styles.td, { width: "15%" }]}>{row.itemName}</Text>
                  <Text style={[styles.td, { width: "8%" }]}>{row.category || "-"}</Text>
                  <Text style={[styles.td, styles.center, { width: "5%" }]}>
                    {row.qty}
                  </Text>
                  <Text style={[styles.td, styles.center, { width: "9%" }]}>{row.date}</Text>
                  <Text style={[styles.td, { width: "9%", fontSize: 6.5 }]}>{row.noRef || "-"}</Text>
                  <Text style={[styles.td, { width: "10%", fontSize: 6.5 }]}>
                    {row.sourceOrReason || "-"}
                  </Text>
                  <Text style={[styles.td, { width: "9%", fontSize: 6.5 }]}>
                    {(isIncoming ? row.sender : row.recipient) || "-"}
                  </Text>
                  <Text style={[styles.td, { width: "9%", fontSize: 6.5 }]}>
                    {(isIncoming ? row.recipient : row.target) || "-"}
                  </Text>
                  <Text style={[styles.tdLast, styles.qrText, { width: "22%" }]}>
                    {qrText}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.paragraph}>
          Demikian surat laporan barang {isIncoming ? "masuk" : "keluar"} operasional ini dibuat
          dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
        </Text>

        <View style={styles.signGroup} wrap={false}>
          <View style={styles.signRow}>
            {/* Pengirim / Penerima (Kiri) */}
            <View style={styles.signBox}>
              <View style={styles.signHeader}>
                <Text>{isIncoming ? "Pengirim," : "Penerima,"}</Text>
              </View>
              <View style={styles.signSlot}>
                {props.senderSignatureDataUrl ? (
                  <Image
                    src={props.senderSignatureDataUrl}
                    style={styles.signImage}
                  />
                ) : null}
              </View>
              <Text style={styles.signLine}>
                {props.senderSignerName?.trim() ||
                  props.rows.find((r) =>
                    (isIncoming ? r.sender : r.recipient)?.trim() &&
                    (isIncoming ? r.sender : r.recipient)?.trim() !== "-"
                  )?.[isIncoming ? "sender" : "recipient"] ||
                  "................................"}
              </Text>
            </View>

            {/* Petugas Gudang (Kanan) */}
            <View style={styles.signBox}>
              <View style={styles.signHeader}>
                <Text>Padang, {dateFormatted}</Text>
                <Text>Petugas Gudang,</Text>
              </View>
              <View style={styles.signSlot}>
                {props.petugasSignatureDataUrl ? (
                  <Image
                    src={props.petugasSignatureDataUrl}
                    style={styles.signImage}
                  />
                ) : null}
              </View>
              <Text style={styles.signLine}>
                {props.signerName || "Petugas Gudang SAR"}
              </Text>
              {props.signerNip ? (
                <Text style={styles.signNip}>NIP. {props.signerNip}</Text>
              ) : null}
            </View>
          </View>

          {/* Pengawas Gudang (Tengah Bawah) */}
          <View style={styles.signCenterRow}>
            <View style={styles.signBox}>
              <View style={styles.signHeader}>
                <Text>Mengetahui,</Text>
                <Text>Pengawas Gudang,</Text>
              </View>
              <View style={styles.signSlot}>
                {props.pengawasSignatureDataUrl ? (
                  <Image
                    src={props.pengawasSignatureDataUrl}
                    style={styles.signImage}
                  />
                ) : null}
              </View>
              <Text style={styles.signLine}>
                {pengawasName}
              </Text>
              <Text style={styles.signNip}>
                NIP. {pengawasNip || "197312301998031003"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Tanggal cetak: {dateFormatted}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
