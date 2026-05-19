import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const roster = [
  {"nip":"197409101998031002","name":"ABDUL MALIK, S.Sos.","pangkat":"Pembina IV/a","appointedAt":"01/10/2023","jabatan":"Kepala Kantor Pencarian dan Pertolongan Kelas A Padang"},
  {"nip":"197312301998031003","name":"ALVIZAN Z., S.H.","pangkat":"Penata (III/c)","appointedAt":"01/10/2020","jabatan":"Kepala Subbagian Umum Kantor Pencarian dan Pertolongan Kelas A Padang"},
  {"nip":"197611081998031002","name":"HENDRI, S.Sos.","pangkat":"Penata (III/c)","appointedAt":"01/04/2022","jabatan":"Kepala Seksi Operasi dan Siaga Pencarian dan Pertolongan Kantor Pencarian dan Pertolongan Kelas A Padang"},
  {"nip":"197410051998031001","name":"INARWAN, S.Sos","pangkat":"Penata (III/c)","appointedAt":"01/10/2018","jabatan":"Kepala Seksi Sumber Daya Pencarian dan Pertolongan Kantor Pencarian dan Pertolongan Kelas A Padang"},
  {"nip":"198707252010012018","name":"SUCI SUSANTA ERZA, S.E.","pangkat":"Penata Tk. I (III/d)","appointedAt":"01/04/2022","jabatan":"Arsiparis Ahli Muda"},
  {"nip":"198604182010012002","name":"RANNY FESTOLINA, S.H.","pangkat":"Penata Tk. I (III/d)","appointedAt":"01/04/2023","jabatan":"Penelaah Teknis Kebijakan"},
  {"nip":"198606062010012002","name":"RAYES SARMA, S.Pd.","pangkat":"Penata Tk. I (III/d)","appointedAt":"01/04/2023","jabatan":"Perencana Ahli Pertama"},
  {"nip":"198308292010011020","name":"MUHAMMAD IQBAL, S.Kom.","pangkat":"Penata Tk. I (III/d)","appointedAt":"01/10/2023","jabatan":"Analis Pengelolaan Keuangan APBN Ahli Muda"},
  {"nip":"198902032007122001","name":"IRNIA PERASEPAZUNI, S.H.","pangkat":"Penata (III/c)","appointedAt":"01/04/2022","jabatan":"Penelaah Teknis Kebijakan"},
  {"nip":"198303112007122002","name":"SERLY ZULFITA, A.Md","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/10/2022","jabatan":"Perawat Mahir"},
  {"nip":"198111302010121001","name":"NOFFI EFFENDI, A.Md.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/04/2023","jabatan":"Kepala Kamar Mesin Kapal Kelas II"},
  {"nip":"198405122005021001","name":"ANDRI WANTO, S.H.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/04/2024","jabatan":"Penata Kelola Pencarian dan Pertolongan Ahli Pertama"},
  {"nip":"198211292007121001","name":"ELRIFITWAGIA GUSNA, S.Kep., Ners.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/10/2023","jabatan":"Perawat Mahir"},
  {"nip":"198602162010012018","name":"NOVA FEBRINA, A.Md.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/10/2023","jabatan":"Arsiparis Mahir"},
  {"nip":"199304152019021001","name":"JODY HARRYAWAN, S.I.Kom.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/04/2024","jabatan":"Pranata Hubungan Masyarakat Ahli Pertama"},
  {"nip":"198503212005021001","name":"ROBI SAPUTRA, S.E.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198603092010121001","name":"RENO SAPUTRA, S.AP.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/08/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198712162007121001","name":"ENDRA","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/02/2025","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198307262007121002","name":"RIKO LIKARDO","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/02/2025","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198607272010121002","name":"ATTA PRIONO, S.A.P.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/04/2025","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198706072010011003","name":"IDRINALDIZEN, S.Sos.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/08/2025","jabatan":"Penata Kelola Pencarian dan Pertolongan Ahli Pertama"},
  {"nip":"198803212007121001","name":"YUDI RIVA, S.A.P.","pangkat":"Penata Muda Tk. I (III/b)","appointedAt":"01/08/2025","jabatan":"Penata Kelola Pencarian dan Pertolongan Ahli Pertama"},
  {"nip":"198710072010122002","name":"HILDA WAHYUNI, A.Md.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2019","jabatan":"Pranata Sumber Daya Manusia Aparatur Mahir"},
  {"nip":"198512052007121001","name":"TRI DESYU HERMAN","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2023","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"199111282010121001","name":"NOVI YURANDI","pangkat":"Penata Muda (III/a)","appointedAt":"01/10/2023","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198803192007121002","name":"ANGGI PRAYOGA","pangkat":"Penata Muda (III/a)","appointedAt":"01/10/2023","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198903192007121001","name":"HARI AGUSTIAN, S.A.P.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Penelaah Teknis Kebijakan"},
  {"nip":"198904102007121001","name":"IKHLAS WD PUTRA","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Teknisi Listrik Kelas II"},
  {"nip":"199101172010121002","name":"VIVIEN HANS PRIMA, S.Pd.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198804102010121001","name":"RONI NUR","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198906152010121002","name":"JUNI FIWALMAN","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198605202010011015","name":"RIKO PRADINATA, S.A.P.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198008202007121001","name":"RUDI SUKMA, S.I.Kom.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pengelola Pencarian dan Pertolongan"},
  {"nip":"197901192007121001","name":"METTRIADI, S.A.P.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pengelola Pencarian dan Pertolongan"},
  {"nip":"198309112007121001","name":"HENKI BRIANTO, S.A.P.","pangkat":"Penata Muda (III/a)","appointedAt":"01/04/2024","jabatan":"Pengelola Pencarian dan Pertolongan"},
  {"nip":"199112312010121001","name":"REZI","pangkat":"Penata Muda (III/a)","appointedAt":"01/02/2025","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"197701172010011004","name":"JONRIFAL","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2022","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198210112010011019","name":"OKTA VENDRI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"199008132010121001","name":"TOMI HENDRA PERMANA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"199208172010121001","name":"RYAN AGUS SYAPUTRA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2022","jabatan":"Pranata Pencarian dan Pertolongan Mahir"},
  {"nip":"198705082007121001","name":"WAHYU HIDAYAT","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2019","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198609102010011011","name":"FILTRIA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"199003262010011001","name":"ISKANDAR","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198901222010121001","name":"DIKA FADLI HELMI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198702062010121002","name":"SAMSUL AKMAL","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198906182010121002","name":"AFDAL DINIL HAQ","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198907242010121002","name":"DEKNO","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/10/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198612202010011007","name":"DANIEL CALVIN MATULESSY","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2022","jabatan":"Mualim I Kapal Kelas II"},
  {"nip":"198706142010011007","name":"DEDY SUHENDRI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2022","jabatan":"Masinis I Kapal Kelas II"},
  {"nip":"198107182010011020","name":"JEFRI HUNTER","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2022","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"199103262010121002","name":"AFIF FRIAN RETSA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Juru Minyak Kapal Kelas II"},
  {"nip":"199012242019021001","name":"ILHAM, A.Md.","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Nahkoda Kapal Kelas II"},
  {"nip":"198703172010121001","name":"ADE SAPUTRA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Mualim II Kapal Kelas II"},
  {"nip":"198809302010121001","name":"REZKI HARIADI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Juru Mudi Kelas II"},
  {"nip":"199007232010122001","name":"NOVITA JAYANTI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198906012010011001","name":"MICHAEL HUMAGA NDAHA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2023","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198710052010121001","name":"WINDO","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2024","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198601122010122002","name":"SUSRI EFIANI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/08/2024","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"199105172010122002","name":"KHASQAL ONASFRI, A.Md.","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/12/2024","jabatan":"Pengelola Pencarian dan Pertolongan"},
  {"nip":"198708272008121001","name":"ZULDEPRI PUTRA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/02/2025","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198703252010012020","name":"MARIA PUTRI DARTI","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/02/2025","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198505012010011025","name":"ROMI KURNIA PUTRA","pangkat":"Pengatur Tk. I (II/d)","appointedAt":"01/04/2025","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"198612212010121005","name":"ANDI WIJAYA","pangkat":"Pengatur (II/c)","appointedAt":"01/04/2021","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"199706252017122003","name":"DEBI GEO FANNY","pangkat":"Pengatur (II/c)","appointedAt":"01/08/2024","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"199209242020121003","name":"SEPTIAN ALFINO","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/12/2024","jabatan":"Juru Mudi Kapal Kelas II"},
  {"nip":"199606042020121004","name":"RAHMAT ILAHI","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/12/2024","jabatan":"Mandor Mesin Kapal Kelas II"},
  {"nip":"199412092020121002","name":"APRI RONAL","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/12/2024","jabatan":"Kelasi Kapal Kelas II"},
  {"nip":"199810032020121002","name":"RANDI WAHYUDI","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/12/2024","jabatan":"Juru Minyak Kapal Kelas II"},
  {"nip":"199301302020121003","name":"MICOLA PUTRA ANANDA","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/12/2024","jabatan":"Markonis Kapal Kelas II"},
  {"nip":"199910252020121002","name":"MUHAMMAD KARIM","pangkat":"Pengatur Muda Tk. I (II/b)","appointedAt":"01/01/2026","jabatan":"Pranata Pencarian dan Pertolongan Terampil"},
  {"nip":"200101152020121002","name":"MUHAMMAD SHANDY","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/12/2021","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"199708192020121003","name":"IRSAN","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/12/2021","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"199708082020121003","name":"MUHAMMAD YUSUF","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/12/2021","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"199610162020121001","name":"MIFTAHUL","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/12/2021","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"199612142020121002","name":"HABIB ISMED ASHARI","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/12/2021","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"200405052025062001","name":"TIARA SRIWAHYUNI","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/06/2025","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"200310202025061001","name":"DIDI DARMA PUTRA","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/06/2025","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"200205232025061001","name":"MUHAMAD ZAKI NASUTION","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/06/2025","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"200504222025061001","name":"REZKI MAULANA","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/06/2025","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
  {"nip":"200310192025061001","name":"MUHAMMAD ALVAREZA","pangkat":"Pengatur Muda (II/a)","appointedAt":"01/06/2025","jabatan":"Pranata Pencarian dan Pertolongan Pemula"},
];

const dir = dirname(fileURLToPath(import.meta.url));
const out = join(dir, "..", "data", "staff-roster.ts");

const lines = roster.map(
  (b) => `  {
    nip: ${JSON.stringify(b.nip)},
    name: ${JSON.stringify(b.name)},
    pangkat: ${JSON.stringify(b.pangkat)},
    appointedAt: ${JSON.stringify(b.appointedAt)},
    jabatan: ${JSON.stringify(b.jabatan)},
  }`
);

const content = `import type { InternalBorrowerSeed } from "./internal-borrower-types";

/** Pegawai KPP Padang — daftar kepegawaian utama (~80 orang) */
export const STAFF_ROSTER_SEED: InternalBorrowerSeed[] = [
${lines.join(",\n")},
];
`;

writeFileSync(out, content, "utf8");
console.log(`Wrote ${roster.length} rows to staff-roster.ts`);
