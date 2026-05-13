"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  LogIn,
  Package,
  RotateCcw,
  ChevronLeft,
  ClipboardList,
  QrCode,
} from "lucide-react";
import { PinjamForm } from "./pinjam/pinjam-form";
import { KembaliScanner } from "./kembali/scanner";

type UnitOption = {
  id: string;
  qrCode: string;
  condition: string;
  itemName: string;
  categoryName: string | null;
};

type LandingClientProps = {
  units: UnitOption[];
  successRef?: string;
  errorMessage?: string;
  initialMode?: "none" | "pinjam" | "kembali";
};

type Mode = "none" | "pinjam" | "kembali";

export function LandingClient({
  units,
  successRef,
  errorMessage,
  initialMode = "none",
}: LandingClientProps) {
  const [mode, setMode] = useState<Mode>(
    successRef ? "pinjam" : initialMode
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setMode("none")}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">SAR Inventory</p>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Basarnas Padang
              </p>
            </div>
          </button>

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
        {mode === "none" ? (
          <section className="text-center space-y-2 py-4 sm:py-8">
            <h1 className="text-2xl sm:text-4xl font-semibold text-white">
              Sistem Manajemen Peminjaman
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
              Kelola peminjaman & pengembalian barang operasional Kantor SAR
              Padang. Pilih layanan di bawah ini.
            </p>
          </section>
        ) : null}

        <div
          className={`grid gap-3 transition-all ${
            mode === "none"
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-2"
          }`}
        >
          <ServiceCard
            active={mode === "pinjam"}
            collapsed={mode === "kembali"}
            disabled={false}
            onClick={() =>
              setMode((m) => (m === "pinjam" ? "none" : "pinjam"))
            }
            icon={<ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Peminjaman Barang"
            description="Ajukan permintaan peminjaman barang operasional. Isi data peminjam & pilih unit yang tersedia."
            cta="Mulai Pinjam"
          />
          <ServiceCard
            active={mode === "kembali"}
            collapsed={mode === "pinjam"}
            disabled={false}
            onClick={() =>
              setMode((m) => (m === "kembali" ? "none" : "kembali"))
            }
            icon={<QrCode className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Cek Pengembalian"
            description="Scan QR setiap barang yang dikembalikan untuk diperiksa petugas gudang."
            cta="Mulai Scan"
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

        {mode === "pinjam" ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-6">
            <PinjamForm
              units={units}
              successRef={successRef}
              errorMessage={errorMessage}
            />
          </section>
        ) : null}

        {mode === "kembali" ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-6">
            <div className="max-w-md mx-auto">
              <KembaliScanner />
            </div>
          </section>
        ) : null}

        {mode === "none" ? (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <InfoCard
              icon={<Package className="w-4 h-4 text-orange-400" />}
              title="Setiap barang unik"
              body="Setiap unit fisik punya QR & riwayat sendiri."
            />
            <InfoCard
              icon={<RotateCcw className="w-4 h-4 text-orange-400" />}
              title="Mudah dikembalikan"
              body="Cukup scan QR—tidak perlu isi formulir manual."
            />
            <InfoCard
              icon={<Shield className="w-4 h-4 text-orange-400" />}
              title="Diawasi admin"
              body="Setiap permintaan diverifikasi sebelum disetujui."
            />
          </section>
        ) : null}

        <footer className="pt-6 border-t border-zinc-900 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Kantor SAR Padang — Sistem Inventaris
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
