"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LogIn,
  Package,
  RotateCcw,
  ChevronLeft,
  ClipboardList,
  Building2,
  FileText,
} from "lucide-react";
import { PinjamForm } from "./pinjam/pinjam-form";
import { AppBrand, AppLogo } from "@/components/app-logo";
import type { InternalBorrowerOption } from "@/components/internal-borrower-field";
import type { BorrowCatalogItem, ScanUnitOption } from "@/lib/borrow-catalog";
import { LocationPicker } from "@/components/location-picker";
import type { PublicLocation } from "@/lib/locations";

type LandingClientProps = {
  locations: PublicLocation[];
  selectedLocation: PublicLocation | null;
  catalog: BorrowCatalogItem[];
  scanUnits: ScanUnitOption[];
  internalBorrowers: InternalBorrowerOption[];
  successRef?: string;
  successLoanType?: "internal" | "external" | null;
  errorMessage?: string;
  initialMode?: "none" | "pinjam" | "external";
};

type Mode = "none" | "pinjam" | "external";

export function LandingClient({
  locations,
  selectedLocation,
  catalog,
  scanUnits,
  internalBorrowers,
  successRef,
  successLoanType,
  errorMessage,
  initialMode = "none",
}: LandingClientProps) {
  const [mode, setMode] = useState<Mode>(() => {
    if (successRef) {
      return successLoanType === "external" ? "external" : "pinjam";
    }
    if (initialMode === "pinjam" || initialMode === "external") return initialMode;
    return "none";
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <AppBrand
            size="md"
            onClick={() => setMode("none")}
            subtitle={
              selectedLocation
                ? `Inventaris · ${selectedLocation.name}`
                : "Inventaris Barang · Pilih Lokasi"
            }
          />

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-lg border border-zinc-800 hover:border-orange-500/50 bg-zinc-900/60"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Login Admin</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-10 space-y-4 sm:space-y-6">
        {successRef && selectedLocation ? (
          <LoanSuccessBanner loanId={successRef} />
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        ) : null}

        {mode === "none" ? (
          <section className="text-center space-y-3 py-4 sm:py-8">
            <AppLogo size="lg" className="mx-auto" priority />
            <h1 className="text-2xl sm:text-4xl font-semibold text-white">
              Sistem Manajemen Peminjaman
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
              Pilih lokasi gudang (KPP Padang, Pos SAR daerah lain), lalu ajukan
              peminjaman barang operasional.
            </p>
          </section>
        ) : null}

        {mode === "none" ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Pilih Lokasi Gudang</h2>
            <LocationPicker
              locations={locations}
              selectedSlug={selectedLocation?.slug ?? null}
            />
          </section>
        ) : null}

        {selectedLocation && mode === "none" ? (
          <p className="text-center text-xs text-emerald-400/90">
            Lokasi aktif: <strong>{selectedLocation.name}</strong> — pilih layanan di bawah.
          </p>
        ) : null}

        {!selectedLocation && mode !== "none" ? (
          <p className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 text-center">
            Pilih lokasi gudang terlebih dahulu di beranda.
          </p>
        ) : null}

        <div
          className={`grid gap-3 transition-all ${
            !selectedLocation
              ? "hidden"
              : mode === "none"
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-2"
          }`}
        >
          <ServiceCard
            active={mode === "pinjam"}
            collapsed={mode === "external"}
            disabled={!selectedLocation}
            onClick={() => {
              if (!selectedLocation) return;
              setMode((m) => (m === "pinjam" ? "none" : "pinjam"));
            }}
            icon={<ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Peminjaman Internal"
            description="Tim SAR — autofill nama & jabatan (daftar sama seperti KPP Padang)."
            cta="Mulai Pinjam"
          />
          <ServiceCard
            active={mode === "external"}
            collapsed={mode === "pinjam"}
            disabled={!selectedLocation}
            onClick={() => {
              if (!selectedLocation) return;
              setMode((m) => (m === "external" ? "none" : "external"));
            }}
            icon={<Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Peminjaman Eksternal"
            description="Untuk instansi lain di luar Tim SAR. Sertakan instansi, nomor surat & contact person."
            cta="Mulai Pinjam"
          />
        </div>

        {mode !== "none" ? (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setMode("none")}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Kembali ke beranda
            </button>
          </div>
        ) : null}

        {mode === "pinjam" && selectedLocation ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-6">
            <PinjamForm
              locationId={selectedLocation.id}
              locationSlug={selectedLocation.slug}
              locationName={selectedLocation.name}
              catalog={catalog}
              scanUnits={scanUnits}
              internalBorrowers={internalBorrowers}
              successRef={successRef}
              errorMessage={errorMessage}
            />
          </section>
        ) : null}

        {mode === "external" && selectedLocation ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-6">
            <PinjamForm
              external
              locationId={selectedLocation.id}
              locationSlug={selectedLocation.slug}
              locationName={selectedLocation.name}
              catalog={catalog}
              scanUnits={scanUnits}
              successRef={successRef}
              errorMessage={errorMessage}
            />
          </section>
        ) : null}

        {mode === "none" ? (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <InfoCard
              icon={<Package className="w-4 h-4 text-orange-400" />}
              title="Pinjam per jenis"
              body="Cari Medkit, Tenda, dll. lalu tentukan jumlah unit — surat PDF ringkas."
            />
            <InfoCard
              icon={<RotateCcw className="w-4 h-4 text-orange-400" />}
              title="Pengembalian by Admin"
              body="Cek pengembalian dilakukan petugas gudang via panel admin."
            />
            <InfoCard
              icon={<AppLogo size="xs" className="opacity-90" />}
              title="Diawasi admin"
              body="Setiap permintaan diverifikasi sebelum disetujui."
            />
          </section>
        ) : null}

        <footer className="pt-6 border-t border-zinc-900 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Minang Rescue · KPP Padang — Sistem Inventaris
        </footer>
      </main>
    </div>
  );
}

function ServiceCard({
  active,
  collapsed,
  onClick,
  icon,
  title,
  description,
  cta,
}: {
  active: boolean;
  collapsed: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border transition-all overflow-hidden ${
        active
          ? "border-orange-500/60 bg-orange-500/10 ring-1 ring-orange-500/30"
          : collapsed
            ? "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
            : "border-zinc-800 bg-zinc-900/60 hover:border-orange-500/40 hover:bg-zinc-900"
      } ${collapsed ? "p-3 sm:p-4" : "p-4 sm:p-6"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-xl flex items-center justify-center ${
            active ? "bg-orange-600 text-white" : "bg-zinc-800 text-orange-400"
          } ${collapsed ? "w-9 h-9" : "w-11 h-11 sm:w-12 sm:h-12"}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`font-semibold text-white ${
              collapsed ? "text-sm" : "text-base sm:text-lg"
            }`}
          >
            {title}
          </h3>
          {!collapsed ? (
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {description}
            </p>
          ) : null}
          {!collapsed && !active ? (
            <span className="inline-flex items-center mt-3 text-xs font-medium text-orange-400">
              {cta} →
            </span>
          ) : null}
          {active && !collapsed ? (
            <span className="inline-flex items-center mt-3 text-xs font-medium text-orange-300">
              Terpilih · klik lagi untuk batal
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function LoanSuccessBanner({ loanId }: { loanId: string }) {
  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/40 px-3 py-3 space-y-2">
      <p className="text-sm text-emerald-300">
        Request berhasil dikirim. Nomor referensi:{" "}
        <strong className="font-mono">{loanId}</strong>
      </p>
      <p className="text-xs text-emerald-200/80">
        Draft surat peminjaman (watermark DRAFT). Setelah disetujui admin, surat resmi
        tanpa watermark akan diberikan.
      </p>
      <a
        href={`/api/loans/${loanId}/pdf?draft=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
      >
        <FileText className="w-3.5 h-3.5" />
        Lihat / Unduh Draft Surat
      </a>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-sm font-medium text-zinc-100">{title}</p>
      </div>
      <p className="text-xs text-zinc-400">{body}</p>
    </div>
  );
}
