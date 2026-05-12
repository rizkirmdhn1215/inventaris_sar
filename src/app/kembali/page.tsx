import Link from "next/link";
import { Shield } from "lucide-react";
import { KembaliScanner } from "./scanner";

export default function KembaliPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Pengembalian Barang</h1>
              <p className="text-xs text-zinc-400">SAR Padang</p>
            </div>
          </div>
          <Link href="/" className="text-xs text-zinc-400 hover:text-white">
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
