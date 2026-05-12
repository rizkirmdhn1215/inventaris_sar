---
name: sar-inventory-system
description: >
  Panduan lengkap untuk membangun sistem inventaris barang SAR Padang (Basarnas).
  Gunakan skill ini setiap kali mengerjakan fitur apapun dari proyek ini — baik itu
  setup database, halaman peminjam, dashboard admin, QR generator, PDF surat, alur
  return, kondisi barang, atau notifikasi. Skill ini adalah satu-satunya sumber
  kebenaran untuk arsitektur, konvensi kode, schema DB, dan business logic proyek ini.
---

# SAR Inventory System

Sistem manajemen peminjaman barang operasional SAR Padang (Basarnas), dibangun dengan
Next.js 15 + Supabase. Semua halaman harus **mobile-first dan responsive** karena
admin, petugas, dan peminjam semua bisa mengakses dari HP masing-masing.

---

## Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database + Auth + Storage | Supabase |
| Realtime & Push Notif | Supabase Realtime + Web Push API (VAPID) |
| QR Generate | `qrcode` (npm) |
| QR Scan | `@zxing/browser` (works di kamera HP & webcam) |
| PDF Surat | `@react-pdf/renderer` |
| Styling | Tailwind CSS v4 |
| Print QR Stiker | CSS `@media print` layout, no extra lib |
| File Upload (foto kondisi) | Supabase Storage |

---

## Struktur Folder

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
│   ├── ui/                   ← shared components
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

## Database Schema (PostgreSQL / Supabase)

Jalankan SQL ini di Supabase SQL Editor secara berurutan:

```sql
-- 1. Kategori barang
create table item_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- 2. Master barang (jenis)
create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references item_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  created_at timestamptz default now()
);

-- 3. Unit fisik spesifik (per stiker QR)
create table item_units (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  qr_code text not null unique,          -- format: SAR-[KODE]-[0001]
  condition text not null default 'good' -- good | damaged | lost
    check (condition in ('good','damaged','lost')),
  status text not null default 'available' -- available | borrowed
    check (status in ('available','borrowed')),
  notes text,
  created_at timestamptz default now()
);

-- 4. Sesi peminjaman
create table loans (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  borrower_division text not null,
  purpose text not null,
  borrow_date date not null,
  expected_return_date date not null,
  status text not null default 'pending'  -- pending | approved | returned
    check (status in ('pending','approved','returned')),
  document_url text,                      -- URL PDF surat di Supabase Storage
  approved_by text,                       -- nama admin yang approve
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- 5. Barang yang dipinjam dalam 1 sesi loan
create table loan_items (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete cascade,
  item_unit_id uuid references item_units(id),
  condition_at_borrow text not null default 'good'
    check (condition_at_borrow in ('good','damaged','lost'))
);

-- 6. Sesi pengecekan pengembalian
create table return_checks (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references loans(id) on delete cascade,
  checked_by text not null,              -- nama petugas pemeriksa
  returned_at timestamptz default now()
);

-- 7. Laporan kondisi per unit saat return
create table condition_reports (
  id uuid primary key default gen_random_uuid(),
  return_check_id uuid references return_checks(id) on delete cascade,
  item_unit_id uuid references item_units(id),
  condition_result text not null
    check (condition_result in ('good','damaged','lost')),
  damage_description text,               -- wajib diisi jika bukan 'good'
  photo_urls text[],                     -- array URL foto di Supabase Storage
  severity text                          -- minor | major | total_loss
    check (severity in ('minor','major','total_loss')),
  created_at timestamptz default now()
);

-- 8. Push notification subscriptions
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
```

### Row Level Security (RLS)

```sql
-- item_units, items, item_categories: public read
alter table item_units enable row level security;
create policy "public read units" on item_units for select using (true);

-- loans: public insert (peminjam bisa buat request)
alter table loans enable row level security;
create policy "public insert loans" on loans for insert with check (true);
create policy "public read own loans" on loans for select using (true);

-- Admin operations via service_role key dari API routes (bypass RLS)
```

---

## QR Code Format

```
SAR-[KODE_ITEM]-[NOMOR_URUT_4_DIGIT]

Contoh:
SAR-CHAINSAW-0001
SAR-CHAINSAW-0002
SAR-WALKIE-0001
SAR-TALI-0023
SAR-SCBA-0005
```

### lib/qr.ts

```typescript
export function generateQrCode(itemCode: string, unitNumber: number): string {
  const padded = String(unitNumber).padStart(4, '0')
  return `SAR-${itemCode.toUpperCase()}-${padded}`
}

export function parseQrCode(qrCode: string) {
  const parts = qrCode.split('-')
  return {
    prefix: parts[0],        // "SAR"
    itemCode: parts[1],      // "CHAINSAW"
    unitNumber: parts[2],    // "0001"
  }
}
```

---

## Batch QR Generate Flow

Halaman: `/admin/qr-generator`

1. Admin input nama barang dengan separator koma:
   ```
   Chainsaw, Walkie Talkie, Tali Kernmantle
   ```
2. Admin input jumlah per barang (atau satu jumlah untuk semua)
3. System:
   - Buat record `item_units` di DB
   - Generate QR code per unit
   - Render print layout: grid stiker A4 (4×7 = 28 stiker per halaman)
4. Admin klik **Print** → CSS `@media print` mengatur layout stiker

### Konten tiap stiker:
- QR code image (150×150px)
- Nama barang
- Kode unit (contoh: `SAR-CHAINSAW-0001`)
- Logo SAR kecil (opsional)

---

## Alur Peminjaman

### Sisi Peminjam (mobile, `/pinjam`)

1. Isi form: nama lengkap, divisi/satuan, keperluan, tanggal pinjam, tanggal kembali rencana
2. Pilih barang dari list (filter by kategori, hanya tampil yang `status = 'available'`)
3. Submit → insert ke tabel `loans` + `loan_items` dengan status `pending`
4. Tampilkan konfirmasi + nomor referensi loan

### Sisi Admin (mobile-friendly, `/admin/peminjaman`)

1. Terima push notification: *"Request peminjaman baru dari [nama]"*
2. Review detail request
3. Edit surat PDF jika perlu (nama, tanggal, daftar barang)
4. Klik **Approve & Generate Surat**:
   - Generate PDF via `@react-pdf/renderer`
   - Upload ke Supabase Storage
   - Update `loans.status = 'approved'`
   - Update `item_units.status = 'borrowed'` untuk semua unit di loan ini
5. Cetak surat → TTD basah manual (di luar sistem)

---

## Alur Pengembalian

### Sisi Peminjam (mobile, `/kembali`)

1. Buka halaman return
2. Scan QR code tiap barang yang dikembalikan satu per satu (pakai kamera HP)
3. Sistem identifikasi barang dari QR → tampilkan info barang
4. Submit daftar barang yang di-scan

### Sisi Petugas/Admin (mobile-friendly, `/admin/pengembalian`)

1. Pilih loan yang sedang diproses return
2. Untuk tiap unit yang dikembalikan:
   - Pilih kondisi: `good` | `damaged` | `lost`
   - Jika bukan `good`: **wajib** isi deskripsi + upload ≥1 foto
   - Pilih severity: `minor` | `major` | `total_loss`
3. Submit → sistem:
   - Insert `return_checks` + `condition_reports`
   - Update `item_units.condition` dan `item_units.status = 'available'`
   - Update `loans.status = 'returned'`

---

## Push Notification (Web Push / VAPID)

### Setup

```bash
npm install web-push
npx web-push generate-vapid-keys
```

Simpan keys di `.env`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@sarpadang.go.id
```

### Flow

1. Admin buka dashboard → browser minta permission notifikasi
2. Jika granted → kirim subscription object ke `POST /api/push/subscribe`
3. Simpan ke tabel `push_subscriptions`
4. Saat peminjam submit request → `POST /api/push/send` trigger notif ke semua admin

### lib/push.ts

```typescript
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToAllAdmins(payload: {
  title: string
  body: string
}) {
  // fetch all subscriptions from DB, send to each
}
```

---

## Dashboard Admin (`/admin/dashboard`)

### Widget yang ditampilkan (bulan berjalan):

| Widget | Data Source |
|---|---|
| Total barang di gudang | `count(item_units) where status='available'` |
| Total sedang dipinjam | `count(item_units) where status='borrowed'` |
| Request pending | `count(loans) where status='pending'` |
| Peminjaman bulan ini | `count(loans) where borrow_date >= awal_bulan` |
| Barang rusak/hilang | `count(item_units) where condition != 'good'` |
| Log history terbaru | `loans` join `borrower_name`, sortir `created_at desc` |

### Filter log history:
- Per bulan
- Per nama peminjam
- Per nama barang
- Per status (pending/approved/returned)

---

## PDF Surat Peminjaman

Gunakan `@react-pdf/renderer`. Template harus mengikuti format resmi SAR Padang.

### Komponen: `SuratPeminjamanDocument`

Field yang harus ada di surat:
- Kop surat SAR Padang / Basarnas
- Nomor surat (generate otomatis: `SAR/INV/[YYYY]/[COUNTER]`)
- Nama & divisi peminjam
- Keperluan/tujuan
- Tanggal pinjam & rencana kembali
- Tabel daftar barang (nama, kode unit, kondisi saat dipinjam)
- Kolom tanda tangan (peminjam + petugas gudang)

Admin bisa edit field sebelum generate PDF.

---

## Konvensi Kode

- Semua server actions dan API routes pakai `supabase` dengan `service_role` key
- Semua client component yang butuh auth pakai `createBrowserClient`
- Nama file: `kebab-case.tsx`
- Nama komponen: `PascalCase`
- Gunakan TypeScript strict mode
- Error handling wajib pakai try/catch dengan pesan yang user-friendly

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

---

## Fase Development

```
Phase 1 — Foundation
  ✦ Setup Next.js 15 + Supabase + schema DB
  ✦ Supabase Auth untuk admin (email + password)

Phase 2 — Master Barang & QR
  ✦ CRUD kategori & master barang
  ✦ Batch generate unit + QR code
  ✦ Print layout stiker A4

Phase 3 — Alur Pinjam
  ✦ Halaman peminjam mobile-first (/pinjam)
  ✦ Form request tanpa login
  ✦ Admin review + approve + generate PDF surat
  ✦ Web Push notification ke admin

Phase 4 — Alur Return
  ✦ Scan QR return via HP (/kembali)
  ✦ Admin/petugas input kondisi + foto upload
  ✦ Update status unit di DB

Phase 5 — Dashboard & Polish
  ✦ Dashboard statistik bulan ini
  ✦ Log history dengan filter
  ✦ Responsive QA semua halaman (mobile + desktop)
```

---

## Catatan Penting

- **Semua halaman harus responsive** — admin mengakses dari laptop maupun HP
- Halaman `/pinjam` dan `/kembali` dirancang **mobile-first** (lebar max 480px optimal)
- QR Scanner (`@zxing/browser`) harus minta permission kamera dan handle error gracefully
- Foto kondisi barang disimpan di Supabase Storage bucket `condition-photos` (public read)
- PDF surat disimpan di bucket `loan-documents` (private, hanya admin)
- Format tanggal selalu **DD MMMM YYYY** (Indonesia locale)
- Semua teks UI dalam **Bahasa Indonesia**
