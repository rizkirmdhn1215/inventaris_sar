import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatTanggalID(date: Date | string | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#0a0a0a" },
  pageCompact: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#0a0a0a" },
  // A4 portrait is 595pt wide; page padding is 48pt. We use explicit page
  // width and negative margins so the letterhead image bleeds edge-to-edge.
  kopImage: {
    width: 595,
    marginLeft: -48,
    marginRight: -48,
    marginTop: -48,
    marginBottom: 16,
  },
  kopImageCompact: {
    width: 595,
    marginLeft: -40,
    marginRight: -40,
    marginTop: -40,
    marginBottom: 12,
  },
  kop: { borderBottomWidth: 2, borderBottomColor: "#ea580c", paddingBottom: 12, marginBottom: 16, textAlign: "center" },
  kopCompact: { borderBottomWidth: 2, borderBottomColor: "#ea580c", paddingBottom: 8, marginBottom: 12, textAlign: "center" },
  kopTitle: { fontSize: 14, fontWeight: 700 },
  kopSub: { fontSize: 10, color: "#525252", marginTop: 2 },
  judul: { textAlign: "center", fontSize: 12, fontWeight: 700, marginVertical: 16, textDecoration: "underline" },
  judulCompact: { textAlign: "center", fontSize: 12, fontWeight: 700, marginVertical: 10, textDecoration: "underline" },
  nomor: { textAlign: "center", fontSize: 10, marginBottom: 16 },
  nomorCompact: { textAlign: "center", fontSize: 10, marginBottom: 10 },
  paragraph: { marginBottom: 8, lineHeight: 1.5, textAlign: "justify" },
  paragraphCompact: { marginBottom: 5, lineHeight: 1.4, textAlign: "justify" },
  row: { flexDirection: "row", marginBottom: 4 },
  rowCompact: { flexDirection: "row", marginBottom: 3 },
  label: { width: 100 },
  colon: { width: 12 },
  value: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#262626", marginTop: 8, marginBottom: 16 },
  tableCompact: { borderWidth: 1, borderColor: "#262626", marginTop: 6, marginBottom: 10 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#262626" },
  trLast: { flexDirection: "row" },
  th: { padding: 6, fontWeight: 700, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 10 },
  thCompact: { padding: 4, fontWeight: 700, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 9.5 },
  td: { padding: 6, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 10 },
  tdCompact: { padding: 4, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 9.5 },
  tdLast: { padding: 6, fontSize: 10 },
  tdLastCompact: { padding: 4, fontSize: 9.5 },
  signGroup: { marginTop: 24 },
  signGroupCompact: { marginTop: 14 },
  signRow: { flexDirection: "row", justifyContent: "space-between" },
  signBox: { width: "40%", textAlign: "center" },
  /** Blank line so peminjam signature aligns with petugas (date line on the right). */
  signLabelSpacer: { fontSize: 11, lineHeight: 1.4 },
  signImage: { height: 50, objectFit: "contain", marginTop: 4, marginBottom: 4 },
  signLine: { marginTop: 50, borderTopWidth: 1, borderTopColor: "#0a0a0a", paddingTop: 4 },
  signLineWithImage: { marginTop: 4, borderTopWidth: 1, borderTopColor: "#0a0a0a", paddingTop: 4 },
  signNip: { marginTop: 4, fontSize: 9, color: "#404040" },
  signCenterRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  signCenterRowCompact: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  signCenterBox: { width: "40%", textAlign: "center" },
  watermark: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    textAlign: "center",
    transform: "rotate(-30deg)",
  },
  watermarkText: {
    fontSize: 140,
    fontWeight: 700,
    color: "#dc2626",
    opacity: 0.15,
    letterSpacing: 8,
  },
});

export type SuratPeminjamanProps = {
  letterNumber: string;
  letterBody: string;
  borrowerName: string;
  borrowerDivision: string;
  purpose: string;
  borrowDate: Date | string;
  expectedReturnDate: Date | string;
  borrowerSignerName: string;
  adminSignerName: string;
  adminSignerNip?: string;
  pengawasGudangName?: string;
  pengawasGudangNip?: string;
  /** @deprecated use pengawasGudangName */
  kepalaGudangName?: string;
  items: {
    itemName: string;
    quantity: number;
    merk?: string | null;
    condition: string;
  }[];
  /**
   * Optional letterhead image (PNG/JPG Buffer). If provided, used as header.
   * Otherwise a text header is rendered.
   */
  kopImage?: Buffer | null;
  /** If true, render a "DRAFT" watermark across the page. */
  isDraft?: boolean;
  /**
   * If true, use tighter spacing throughout so short documents are more
   * likely to keep the signature block on the same page as the content.
   */
  compact?: boolean;
  /** Base64 PNG data URL for drawn/uploaded signatures */
  borrowerSignatureDataUrl?: string | null;
  adminSignatureDataUrl?: string | null;
  pengawasSignatureDataUrl?: string | null;
  /** Scale factor (0–200) as a percentage for each signature image */
  borrowerSignatureScale?: number;
  adminSignatureScale?: number;
  pengawasSignatureScale?: number;
};

/** Compute a clamped image height from the scale percentage (default 100 %). */
function sigHeight(scale?: number): number {
  const pct = Math.min(200, Math.max(10, scale ?? 100));
  // Base height = 50 pt, scaled proportionally
  return Math.round(50 * (pct / 100));
}

export function SuratPeminjamanDocument(props: SuratPeminjamanProps) {
  const pengawasName =
    props.pengawasGudangName?.trim() || props.kepalaGudangName?.trim() || "";
  const pengawasNip = props.pengawasGudangNip?.trim() || "";
  const compact = props.compact ?? false;

  // Compact mode style helpers
  const s = {
    page: compact ? styles.pageCompact : styles.page,
    kopImage: compact ? styles.kopImageCompact : styles.kopImage,
    kop: compact ? styles.kopCompact : styles.kop,
    judul: compact ? styles.judulCompact : styles.judul,
    nomor: compact ? styles.nomorCompact : styles.nomor,
    paragraph: compact ? styles.paragraphCompact : styles.paragraph,
    row: compact ? styles.rowCompact : styles.row,
    table: compact ? styles.tableCompact : styles.table,
    th: compact ? styles.thCompact : styles.th,
    td: compact ? styles.tdCompact : styles.td,
    tdLast: compact ? styles.tdLastCompact : styles.tdLast,
    signGroup: compact ? styles.signGroupCompact : styles.signGroup,
    signCenterRow: compact ? styles.signCenterRowCompact : styles.signCenterRow,
  };

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {props.isDraft ? (
          <View style={styles.watermark} fixed>
            <Text style={styles.watermarkText}>DRAFT</Text>
          </View>
        ) : null}
        {props.kopImage ? (
          <Image style={s.kopImage} src={props.kopImage} />
        ) : (
          <View style={s.kop}>
            <Text style={styles.kopTitle}>BADAN NASIONAL PENCARIAN DAN PERTOLONGAN</Text>
            <Text style={styles.kopTitle}>KANTOR PENCARIAN DAN PERTOLONGAN PADANG</Text>
            <Text style={styles.kopSub}>Jl. Adinegoro Km. 17, Padang - Sumatera Barat</Text>
          </View>
        )}

        <Text style={s.judul}>SURAT PEMINJAMAN BARANG OPERASIONAL</Text>
        <Text style={s.nomor}>Nomor: {props.letterNumber}</Text>

        <Text style={s.paragraph}>
          Yang bertanda tangan di bawah ini menerangkan bahwa telah dilakukan peminjaman barang
          operasional dari Kantor SAR Padang dengan rincian sebagai berikut:
        </Text>

        <View style={s.row}>
          <Text style={styles.label}>Nama Peminjam</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.borrowerName}</Text>
        </View>
        <View style={s.row}>
          <Text style={styles.label}>Divisi / Satuan</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.borrowerDivision}</Text>
        </View>
        <View style={s.row}>
          <Text style={styles.label}>Keperluan</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.purpose}</Text>
        </View>
        <View style={s.row}>
          <Text style={styles.label}>Tanggal Pinjam</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{formatTanggalID(props.borrowDate)}</Text>
        </View>
        <View style={s.row}>
          <Text style={styles.label}>Rencana Kembali</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{formatTanggalID(props.expectedReturnDate)}</Text>
        </View>

        <Text style={[s.paragraph, { marginTop: compact ? 8 : 12 }]}>Daftar barang yang dipinjam:</Text>
        <View style={s.table}>
          <View style={styles.tr}>
            <Text style={[s.th, { width: 40 }]}>No</Text>
            <Text style={[s.th, { flex: 2 }]}>Nama Barang</Text>
            <Text style={[s.th, { flex: 1 }]}>Merk</Text>
            <Text style={[s.th, { width: 56 }]}>Jumlah</Text>
            <Text style={[s.th, { flex: 1, borderRightWidth: 0 }]}>Kondisi</Text>
          </View>
          {props.items.map((item, i) => {
            const isLast = i === props.items.length - 1;
            const RowView = isLast ? styles.trLast : styles.tr;
            return (
              <View key={i} style={RowView}>
                <Text style={[s.td, { width: 40 }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 2 }]}>{item.itemName}</Text>
                <Text style={[s.td, { flex: 1 }]}>{item.merk ?? "-"}</Text>
                <Text style={[s.td, { width: 56 }]}>{item.quantity}</Text>
                <Text style={[s.tdLast, { flex: 1 }]}>{item.condition}</Text>
              </View>
            );
          })}
        </View>

        {props.letterBody ? (
          <Text style={s.paragraph}>{props.letterBody}</Text>
        ) : null}

        <Text style={s.paragraph}>
          Demikian surat peminjaman ini dibuat untuk dipergunakan sebagaimana mestinya.
        </Text>

        {/* ── Signature block — wrap={false} keeps it together on same page ── */}
        <View style={s.signGroup} wrap={false}>
          <View style={styles.signRow}>
            {/* Peminjam */}
            <View style={styles.signBox}>
              <Text>Peminjam,</Text>
              {props.borrowerSignatureDataUrl ? (
                <Image
                  src={props.borrowerSignatureDataUrl}
                  style={[styles.signImage, { height: sigHeight(props.borrowerSignatureScale) }]}
                />
              ) : (
                <Text style={styles.signLabelSpacer}>{" "}</Text>
              )}
              <Text
                style={
                  props.borrowerSignatureDataUrl
                    ? styles.signLineWithImage
                    : styles.signLine
                }
              >
                {props.borrowerSignerName}
              </Text>
            </View>

            {/* Petugas Gudang */}
            <View style={styles.signBox}>
              <Text>Padang, {formatTanggalID(new Date())}</Text>
              <Text>Petugas Gudang,</Text>
              {props.adminSignatureDataUrl ? (
                <Image
                  src={props.adminSignatureDataUrl}
                  style={[styles.signImage, { height: sigHeight(props.adminSignatureScale) }]}
                />
              ) : (
                <Text style={styles.signLabelSpacer}>{" "}</Text>
              )}
              <Text
                style={
                  props.adminSignatureDataUrl
                    ? styles.signLineWithImage
                    : styles.signLine
                }
              >
                {props.adminSignerName}
              </Text>
              {props.adminSignerNip ? (
                <Text style={styles.signNip}>NIP. {props.adminSignerNip}</Text>
              ) : null}
            </View>
          </View>

          {pengawasName ? (
            <View style={s.signCenterRow}>
              <View style={styles.signCenterBox}>
                <Text>Mengetahui,</Text>
                <Text>Pengawas Gudang,</Text>
                {props.pengawasSignatureDataUrl ? (
                  <Image
                    src={props.pengawasSignatureDataUrl}
                    style={[styles.signImage, { height: sigHeight(props.pengawasSignatureScale) }]}
                  />
                ) : (
                  <Text style={styles.signLabelSpacer}>{" "}</Text>
                )}
                <Text
                  style={
                    props.pengawasSignatureDataUrl
                      ? styles.signLineWithImage
                      : styles.signLine
                  }
                >
                  {pengawasName}
                </Text>
                {pengawasNip ? (
                  <Text style={styles.signNip}>NIP. {pengawasNip}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
