import Link from "next/link";
import { redirect } from "next/navigation";
import { listInternalBorrowers } from "@/lib/internal-borrowers";
import { getBorrowCatalog, getScannableUnits } from "@/lib/borrow-catalog";
import { getLocationBySlug } from "@/lib/location-scope";
import { PinjamForm } from "./pinjam-form";
import { AppBrand } from "@/components/app-logo";

type PinjamPageProps = {
  searchParams: Promise<{ success?: string; error?: string; lokasi?: string }>;
};

export default async function PinjamPage({ searchParams }: PinjamPageProps) {
  const params = await searchParams;
  if (!params.lokasi) redirect("/?error=Pilih%20lokasi%20gudang");

  const location = await getLocationBySlug(params.lokasi);
  if (!location) redirect("/?error=Lokasi%20tidak%20ditemukan");

  const [catalog, scanUnits, internalBorrowers] = await Promise.all([
    getBorrowCatalog(location.id),
    getScannableUnits(location.id),
    listInternalBorrowers(location.id),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand
            size="md"
            href={`/?lokasi=${location.slug}`}
            title="Peminjaman Barang"
            subtitle={location.name}
          />
          <Link href="/" className="text-xs text-zinc-400 hover:text-white shrink-0">
            Beranda
          </Link>
        </div>
      </div>
      <PinjamForm
        locationId={location.id}
        locationSlug={location.slug}
        locationName={location.name}
        internalBorrowers={internalBorrowers}
        catalog={catalog}
        scanUnits={scanUnits}
        successRef={params.success}
        errorMessage={params.error}
      />
    </div>
  );
}
