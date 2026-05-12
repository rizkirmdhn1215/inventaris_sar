# SAR Inventory System — Project Document

**Organisasi:** Basarnas / SAR Padang
**Program:** Intern MSIB Kemnaker
**Developer:** Rizki Ramadhan
**Tanggal mulai:** Mei 2026

---

## 1. Overview

Sistem manajemen peminjaman barang operasional SAR Padang. Menggantikan pencatatan
manual dengan sistem digital berbasis web yang dapat diakses dari laptop maupun HP.
Mencakup:

- Pencatatan master barang & unit fisik per stiker QR
- Alur request peminjaman oleh peminjam (tanpa login, mobile-first)
- Approval + generate surat resmi PDF oleh admin
- Alur pengembalian dengan scan QR + pengecekan kondisi barang
- Dashboard monitoring & log history
- Push notification ke admin browser

---

## 2. Goals

- Mempermudah pencatatan barang masuk/keluar gudang SAR
- Tracking kondisi barang **per unit fisik** (bukan hanya per jenis)
- Generate surat peminjaman resmi format SAR secara otomatis
- Admin & petugas bisa approve dan cek barang dari HP
- Peminjam bisa request pinjam dari HP tanpa install app

---

## 3. Roles & Akses

| Role | Akses | Auth | Device |
|---|---|---|---|
| **Admin** | Full access: master barang, approve, cek kondisi, dashboard, QR generator | Supabase Auth (email + password) | Laptop + HP |
| **Peminjam** | Request pinjam, scan QR return | Tidak perlu login — isi nama & divisi di form | HP (mobile-first) |

---

## 4. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 15 (App Router) — `next@16.2.5` |
| Runtime | React 19, TypeScript (strict) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password, admin only) |
| Storage | Supabase Storage (foto kondisi + PDF surat) |
| Realtime & Push | Supabase Realtime + Web Push API (`web-push` + VAPID) |
| QR Generate | `qrcode` (npm) |
| QR Scan | `@zxing/browser` (kamera HP & webcam) |
| PDF Surat | `@react-pdf/renderer` |
| Styling | Tailwind CSS v4 |
| Print Stiker | CSS `@media print` layout |

---

## 5. Database Schema

8 tabel utama di Supabase PostgreSQL:

```
item_categories     → jenis/kategori barang
items               → master barang (per jenis)
item_units          → unit fisik spesifik (per stiker QR)
loans               → sesi peminjaman
loan_items          → detail barang per sesi pinjam
return_checks       → sesi pengecekan pengembalian
condition_reports   → laporan kondisi per unit saat return
push_subscriptions  → data subscription Web Push admin
```

### Key Constraints

- `item_units.condition`: `good` | `damaged` | `lost`
- `item_units.status`: `available` | `borrowed`
- `loans.status`: `pending` | `approved` | `returned`
- `condition_reports.condition_result`: `good` | `damaged` | `lost`
- `condition_reports.severity`: `minor` | `major` | `total_loss`

### RLS Policy

- `item_units`, `items`, `item_categories`: public read
- `loans`: public insert (peminjam bisa buat request), public read
- Admin operations via `service_role` key dari API routes (bypass RLS)

> SQL lengkap ada di `SKILL.md` bagian **Database Schema**

---

## 6. QR Code Format

```
SAR-[KODE_ITEM]-[NOMOR_4_DIGIT]

Contoh:
SAR-CHAINSAW-0001
SAR-WALKIE-0003
SAR-TALI-0021
SAR-SCBA-0005
```

---

## 7. Struktur Folder

```
src/
├── app/
│   ├── (admin)/              ← layout admin, requires Supabase Auth session
│   │   ├── dashboard/        ← statistik bulan ini
│   │   ├── barang/           ← master barang & kategori
│   │   ├── qr-generator/     ← batch generate & print QR stiker
│   │   ├── peminjaman/       ← list request, approve, cetak surat PDF
│   │   └── pengembalian/     ← cek kondisi barang saat return
│   ├── (public)/             ← no auth required
│   │   ├── pinjam/           ← form request peminjaman (mobile-first)
│   │   └── kembali/          ← scan QR + form kondisi return (mobile-first)
│   └── api/
│       ├── loans/
│       ├── returns/
│       ├── items/
│       └── push/             ← Web Push subscription & send endpoint
├── components/
│   ├── ui/                   ← shared components (button, input, modal, dll)
│   ├── qr/                   ← QRGenerator, QRScanner, PrintLayout
│   ├── pdf/                  ← SuratPeminjamanDocument (@react-pdf)
│   └── admin/                ← AdminNav, DashboardCard, dll
├── lib/
│   ├── supabase/
│   │   ├── client.ts         ← createBrowserClient
│   │   └── server.ts         ← createServerClient (cookies)
│   ├── push.ts               ← web-push helper (VAPID)
│   └── qr.ts                 ← generate & parse QR code format
└── types/
    └── index.ts              ← semua TypeScript types/interfaces
```

---

## 8. Alur Sistem

### 8.1 Peminjaman

```
📱 Peminjam isi form request di HP (/pinjam)
        ↓
🔔 Admin dapat push notification di browser
        ↓
👤 Admin review request → edit data surat jika perlu
        ↓
📄 Generate PDF surat resmi SAR otomatis
        ↓
🖨️ Cetak surat → TTD basah manual di luar sistem
        ↓
✅ Admin klik Approve → unit status: borrowed
```

### 8.2 Pengembalian

```
📱 Peminjam scan QR tiap barang via HP (/kembali)
        ↓
👤 Petugas cek fisik kondisi barang
        ↓
📝 Input kondisi (good / damaged / lost)
   Jika rusak/hilang → deskripsi + foto wajib + severity
        ↓
✅ Submit → unit status: available, kondisi terupdate
   loans.status → returned
```

---

## 9. Fitur Lengkap (Checklist)

### 👤 Admin Features

#### Master Data
- [ ] CRUD kategori barang (chainsaw, komunikasi, tali-temali, SCBA, dll)
- [ ] CRUD master barang (nama, deskripsi, foto, kategori)
- [ ] Lihat semua unit fisik per barang beserta status & kondisi

#### QR Generator (`/admin/qr-generator`)
- [ ] Input nama barang dipisah koma: `Chainsaw, Walkie Talkie, Tali`
- [ ] Input jumlah unit per barang (atau satu jumlah untuk semua)
- [ ] Batch generate unit di DB + QR code unik per unit
- [ ] Format QR: `SAR-[KODE]-[0001]`
- [ ] Preview print layout stiker A4 (grid 4×7 = 28 stiker/halaman)
- [ ] Print langsung dari browser via CSS `@media print`
- [ ] Konten stiker: QR image 150×150px, nama barang, kode unit, logo SAR (opsional)

#### Peminjaman (`/admin/peminjaman`)
- [ ] Lihat semua request masuk (status: pending/approved/returned)
- [ ] Review detail request peminjaman
- [ ] Edit data surat sebelum di-approve (nama, tanggal, daftar barang)
- [ ] Generate PDF surat resmi format SAR (`@react-pdf/renderer`)
- [ ] Upload PDF ke Supabase Storage bucket `loan-documents` (private)
- [ ] Approve request → update `loans.status = 'approved'` + `item_units.status = 'borrowed'`
- [ ] Cetak surat (untuk TTD basah manual)

#### Pengembalian & Kondisi (`/admin/pengembalian`)
- [ ] Pilih loan yang sedang dalam proses return
- [ ] Cek kondisi per unit: `good` | `damaged` | `lost`
- [ ] Jika bukan `good`: **wajib** input deskripsi + upload ≥1 foto
- [ ] Pilih severity: `minor` | `major` | `total_loss`
- [ ] Submit → insert `return_checks` + `condition_reports`
- [ ] Update `item_units.condition` dan `item_units.status = 'available'`
- [ ] Update `loans.status = 'returned'`

#### Dashboard (`/admin/dashboard`)
- [ ] Widget: total barang tersedia di gudang
- [ ] Widget: total barang sedang dipinjam
- [ ] Widget: request pending (belum di-approve)
- [ ] Widget: jumlah peminjaman bulan ini
- [ ] Widget: barang dengan kondisi rusak/hilang
- [ ] Log history peminjaman dengan filter (bulan, nama peminjam, nama barang, status)

#### Notifikasi
- [ ] Push notification ke browser admin saat ada request baru masuk
- [ ] Notif saat ada pengembalian yang perlu dicek

---

### 📱 Peminjam Features (Mobile-First, Tanpa Login)

#### Request Pinjam (`/pinjam`)
- [ ] Form: nama lengkap, divisi/satuan, keperluan
- [ ] Pilih tanggal pinjam & rencana kembali
- [ ] Pilih barang dari list (filter by kategori, hanya `status = 'available'`)
- [ ] Submit → insert ke `loans` + `loan_items` dengan status `pending`
- [ ] Tampilkan konfirmasi + nomor referensi peminjaman
- [ ] Trigger push notification ke semua admin

#### Pengembalian (`/kembali`)
- [ ] Scan QR code tiap barang yang dikembalikan satu per satu (pakai kamera HP)
- [ ] Sistem identifikasi barang dari QR → tampilkan info barang
- [ ] Konfirmasi daftar barang yang akan dikembalikan
- [ ] Submit daftar ke sistem

---

## 10. PDF Surat Peminjaman

Template mengikuti format resmi SAR Padang. Komponen: `SuratPeminjamanDocument`.

**Field yang harus ada:**
- Kop surat SAR Padang / Basarnas
- Nomor surat otomatis: `SAR/INV/[YYYY]/[COUNTER]`
- Nama & divisi peminjam
- Keperluan/tujuan peminjaman
- Tanggal pinjam & rencana kembali
- Tabel daftar barang (nama, kode unit, kondisi saat dipinjam)
- Kolom tanda tangan (peminjam + petugas gudang)

> Admin bisa edit field sebelum generate PDF.

---

## 11. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@sarpadang.go.id
```

---

## 12. Fase Development

### Phase 1 — Foundation ⬅️ CURRENT
- [x] Init Next.js 15 project + Tailwind CSS v4
- [ ] Setup Supabase project + jalankan SQL schema
- [ ] Setup Supabase Auth (admin login email + password)
- [ ] Setup env variables
- [ ] Buat Supabase client (`lib/supabase/client.ts` + `server.ts`)
- [ ] Buat types (`types/index.ts`)
- [ ] Layout admin (sidebar desktop / bottom nav mobile) + layout public
- [ ] Middleware auth guard untuk route `(admin)/*`
- [ ] Halaman login admin

### Phase 2 — Master Barang & QR Generator
- [ ] Halaman CRUD kategori barang
- [ ] Halaman CRUD master barang (nama, deskripsi, foto, kategori)
- [ ] Halaman QR Generator (batch input nama + jumlah)
- [ ] Batch generate `item_units` di DB + QR code per unit
- [ ] Print layout stiker A4 (grid 4×7, CSS `@media print`)

### Phase 3 — Alur Peminjaman
- [ ] Halaman `/pinjam` (mobile-first, tanpa login)
- [ ] Form request: pilih barang available, isi data peminjam
- [ ] Admin: list request + detail review
- [ ] Admin: edit & generate PDF surat (`@react-pdf/renderer`)
- [ ] Admin: approve request → update status
- [ ] Setup Web Push (VAPID keys + subscribe + send endpoints)

### Phase 4 — Alur Pengembalian
- [ ] Halaman `/kembali` — scan QR via kamera HP (`@zxing/browser`)
- [ ] Admin/petugas: form cek kondisi + upload foto ke Supabase Storage
- [ ] Update status & kondisi unit di DB
- [ ] Insert `return_checks` + `condition_reports`

### Phase 5 — Dashboard & Polish
- [ ] Dashboard statistik bulan ini (widgets)
- [ ] Log history + filter (bulan, nama, barang, status)
- [ ] Responsive QA — semua halaman (mobile + desktop)
- [ ] Error handling & loading states semua halaman
- [ ] Deploy ke server kantor

---

## 13. Konvensi Kode

| Aturan | Detail |
|---|---|
| Server actions & API routes | Pakai Supabase `service_role` key |
| Client components + auth | Pakai `createBrowserClient` |
| Nama file | `kebab-case.tsx` |
| Nama komponen | `PascalCase` |
| TypeScript | Strict mode |
| Error handling | Wajib try/catch, pesan user-friendly |
| Format tanggal | **DD MMMM YYYY** (Indonesia locale) |
| Bahasa UI | **Bahasa Indonesia** |
| Responsive | Semua halaman harus mobile + desktop |
| Mobile-first | `/pinjam` dan `/kembali` (optimal 480px) |

---

## 14. Storage Buckets (Supabase)

| Bucket | Akses | Isi |
|---|---|---|
| `condition-photos` | Public read | Foto kondisi barang saat pengembalian |
| `loan-documents` | Private (admin only) | PDF surat peminjaman resmi |

---

## 15. Deployment

Self-host di server kantor (sesuai setup Basarnas sebelumnya):
- Docker container Next.js
- Nginx reverse proxy + subdomain (`sarpadang.my.id`)
- Supabase: Cloud (free tier) atau self-hosted
- SSL via Let's Encrypt

---

## 16. Catatan yang Perlu Dikonfirmasi

- [ ] Format resmi surat peminjaman SAR Padang (minta contoh dari petugas gudang)
- [ ] Daftar kategori barang yang akan dipakai
- [ ] Apakah kondisi cukup 3 level (good/damaged/lost) atau butuh tambahan?
- [ ] Siapa saja admin yang perlu didaftarkan?
- [ ] Nomor surat: ada format baku dari kantor?

---

## Referensi

- `SKILL.md` → arsitektur detail, SQL schema lengkap, konvensi kode, business logic
- Stack sebelumnya (Basarnas Absence): `rizkirmdhn1215/Basarnas-Absence`
