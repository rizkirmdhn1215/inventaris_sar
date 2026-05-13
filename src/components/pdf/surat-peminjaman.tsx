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
  kopImage: { width: "100%", marginBottom: 16 },
  kop: { borderBottomWidth: 2, borderBottomColor: "#ea580c", paddingBottom: 12, marginBottom: 16, textAlign: "center" },
  kopTitle: { fontSize: 14, fontWeight: 700 },
  kopSub: { fontSize: 10, color: "#525252", marginTop: 2 },
  judul: { textAlign: "center", fontSize: 12, fontWeight: 700, marginVertical: 16, textDecoration: "underline" },
  nomor: { textAlign: "center", fontSize: 10, marginBottom: 16 },
  paragraph: { marginBottom: 8, lineHeight: 1.5, textAlign: "justify" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 100 },
  colon: { width: 12 },
  value: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#262626", marginTop: 8, marginBottom: 16 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#262626" },
  trLast: { flexDirection: "row" },
  th: { padding: 6, fontWeight: 700, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 10 },
  td: { padding: 6, borderRightWidth: 1, borderRightColor: "#262626", fontSize: 10 },
  tdLast: { padding: 6, fontSize: 10 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  signBox: { width: "40%", textAlign: "center" },
  signLine: { marginTop: 60, borderTopWidth: 1, borderTopColor: "#0a0a0a", paddingTop: 4 },
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
  items: { itemName: string; qrCode: string; condition: string }[];
  /**
   * Optional letterhead image (PNG/JPG Buffer). If provided, used as header.
   * Otherwise a text header is rendered.
   */
  kopImage?: Buffer | null;
  /** If true, render a "DRAFT" watermark across the page. */
  isDraft?: boolean;
};

export function SuratPeminjamanDocument(props: SuratPeminjamanProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {props.isDraft ? (
          <View style={styles.watermark} fixed>
            <Text style={styles.watermarkText}>DRAFT</Text>
          </View>
        ) : null}
        {props.kopImage ? (
          <Image style={styles.kopImage} src={props.kopImage} />
        ) : (
          <View style={styles.kop}>
            <Text style={styles.kopTitle}>BADAN NASIONAL PENCARIAN DAN PERTOLONGAN</Text>
            <Text style={styles.kopTitle}>KANTOR PENCARIAN DAN PERTOLONGAN PADANG</Text>
            <Text style={styles.kopSub}>Jl. Adinegoro Km. 17, Padang - Sumatera Barat</Text>
          </View>
        )}

        <Text style={styles.judul}>SURAT PEMINJAMAN BARANG OPERASIONAL</Text>
        <Text style={styles.nomor}>Nomor: {props.letterNumber}</Text>

        <Text style={styles.paragraph}>
          Yang bertanda tangan di bawah ini menerangkan bahwa telah dilakukan peminjaman barang
          operasional dari Kantor SAR Padang dengan rincian sebagai berikut:
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Nama Peminjam</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.borrowerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Divisi / Satuan</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.borrowerDivision}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Keperluan</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{props.purpose}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tanggal Pinjam</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{formatTanggalID(props.borrowDate)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Rencana Kembali</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.value}>{formatTanggalID(props.expectedReturnDate)}</Text>
        </View>

        <Text style={[styles.paragraph, { marginTop: 12 }]}>Daftar barang yang dipinjam:</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: 40 }]}>No</Text>
            <Text style={[styles.th, { flex: 2 }]}>Nama Barang</Text>
            <Text style={[styles.th, { flex: 2 }]}>Kode Unit</Text>
            <Text style={[styles.th, { flex: 1, borderRightWidth: 0 }]}>Kondisi</Text>
          </View>
          {props.items.map((item, i) => {
            const isLast = i === props.items.length - 1;
            const RowView = isLast ? styles.trLast : styles.tr;
            return (
              <View key={i} style={RowView}>
                <Text style={[styles.td, { width: 40 }]}>{i + 1}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{item.itemName}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{item.qrCode}</Text>
                <Text style={[styles.tdLast, { flex: 1 }]}>{item.condition}</Text>
              </View>
            );
          })}
        </View>

        {props.letterBody ? (
          <Text style={styles.paragraph}>{props.letterBody}</Text>
        ) : null}

        <Text style={styles.paragraph}>
          Demikian surat peminjaman ini dibuat untuk dipergunakan sebagaimana mestinya.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text>Peminjam,</Text>
            <Text style={styles.signLine}>{props.borrowerSignerName}</Text>
          </View>
          <View style={styles.signBox}>
            <Text>Padang, {formatTanggalID(new Date())}</Text>
            <Text>Petugas Gudang,</Text>
            <Text style={styles.signLine}>{props.adminSignerName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
