import Link from "next/link";
import { AppBrand } from "@/components/app-logo";
import { KembaliScanner } from "./scanner";

export default function KembaliPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand
            size="md"
            href="/"
            title="Pengembalian Barang"
            subtitle="Minang Rescue · KPP Padang"
          />
          <Link href="/" className="text-xs text-zinc-400 hover:text-white shrink-0">
            Beranda
          </Link>
        </div>

        <p className="text-sm text-zinc-300">
          Scan QR di tiap barang yang dikembalikan. Petugas gudang akan cek
          kondisi barang setelah ini.
        </p>

        <KembaliScanner />
      </div>
    </div>
  );
}
