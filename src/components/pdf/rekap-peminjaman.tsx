import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
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
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0a0a0a" },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#525252", marginBottom: 16 },
  meta: { marginBottom: 12, lineHeight: 1.4 },
  table: { borderWidth: 1, borderColor: "#262626", marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#262626" },
  trLast: { flexDirection: "row" },
  th: {
    padding: 5,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#262626",
    fontSize: 9,
  },
  td: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: "#262626",
    fontSize: 9,
  },
  tdLast: { padding: 5, fontSize: 9 },
  footer: { marginTop: 16, fontSize: 9, color: "#525252" },
});

export type RekapPeminjamanRow = {
  borrowerName: string;
  borrowerDivision: string;
  borrowDate: Date | string;
  expectedReturnDate: Date | string;
  status: string;
  itemSummary: string;
  purpose: string;
};

export type RekapPeminjamanProps = {
  periodLabel: string;
  filterSummary: string;
  generatedAt: Date;
  rows: RekapPeminjamanRow[];
  totalLoans: number;
};

export function RekapPeminjamanDocument(props: RekapPeminjamanProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>REKAP PEMINJAMAN BARANG</Text>
        <Text style={styles.subtitle}>
          Kantor Pencarian dan Pertolongan Padang — Inventaris SAR
        </Text>

        <View style={styles.meta}>
          <Text>Periode: {props.periodLabel}</Text>
          <Text>Filter: {props.filterSummary}</Text>
          <Text>Total peminjaman: {props.totalLoans}</Text>
          <Text>Dicetak: {formatTanggalID(props.generatedAt)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: 24 }]}>No</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Peminjam</Text>
            <Text style={[styles.th, { flex: 1 }]}>Divisi</Text>
            <Text style={[styles.th, { width: 72 }]}>Pinjam</Text>
            <Text style={[styles.th, { width: 72 }]}>Kembali</Text>
            <Text style={[styles.th, { flex: 1.4 }]}>Barang</Text>
            <Text style={[styles.th, { width: 64 }]}>Status</Text>
          </View>
          {props.rows.map((row, i) => {
            const isLast = i === props.rows.length - 1;
            const RowView = isLast ? styles.trLast : styles.tr;
            return (
              <View key={i} style={RowView}>
                <Text style={[styles.td, { width: 24 }]}>{i + 1}</Text>
                <Text style={[styles.td, { flex: 1.2 }]}>{row.borrowerName}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{row.borrowerDivision}</Text>
                <Text style={[styles.td, { width: 72 }]}>
                  {formatTanggalID(row.borrowDate)}
                </Text>
                <Text style={[styles.td, { width: 72 }]}>
                  {formatTanggalID(row.expectedReturnDate)}
                </Text>
                <Text style={[styles.td, { flex: 1.4 }]}>{row.itemSummary}</Text>
                <Text style={[styles.tdLast, { width: 64 }]}>{row.status}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>
          Dokumen ini dihasilkan otomatis dari filter dashboard admin.
        </Text>
      </Page>
    </Document>
  );
}
