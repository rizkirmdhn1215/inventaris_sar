import Link from "next/link";
import { listInternalBorrowers } from "@/lib/internal-borrowers";
import { getBorrowCatalog, getScannableUnits } from "@/lib/borrow-catalog";
import { PinjamForm } from "./pinjam-form";
import { AppBrand } from "@/components/app-logo";

type PinjamPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function PinjamPage({ searchParams }: PinjamPageProps) {
  const params = await searchParams;
  const [catalog, scanUnits, internalBorrowers] = await Promise.all([
    getBorrowCatalog(),
    getScannableUnits(),
    listInternalBorrowers(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand
            size="md"
            href="/"
            title="Peminjaman Barang"
            subtitle="Minang Rescue · KPP Padang"
          />
          <Link href="/" className="text-xs text-zinc-400 hover:text-white shrink-0">
            Beranda
          </Link>
        </div>
      </div>
      <PinjamForm
        catalog={catalog}
        scanUnits={scanUnits}
        internalBorrowers={internalBorrowers}
        successRef={params.success}
        errorMessage={params.error}
      />
    </div>
  );
}
