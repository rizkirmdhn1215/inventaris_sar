import { listInternalBorrowers } from "@/lib/internal-borrowers";
import { getBorrowCatalog, getScannableUnits } from "@/lib/borrow-catalog";
import { getActiveLocations, getLocationBySlug } from "@/lib/location-scope";
import { db } from "@/lib/db";
import { LandingClient } from "./landing-client";

type HomeProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    mode?: string;
    lokasi?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const locations = await getActiveLocations();
  const selectedLocation = params.lokasi
    ? await getLocationBySlug(params.lokasi)
    : null;

  const [catalog, scanUnits, internalBorrowers] = selectedLocation
    ? await Promise.all([
        getBorrowCatalog(selectedLocation.id),
        getScannableUnits(selectedLocation.id),
        listInternalBorrowers(selectedLocation.id),
      ])
    : [[], [], []];

  const initialMode: "none" | "pinjam" | "external" =
    params.mode === "pinjam" || params.mode === "external" ? params.mode : "none";

  let successLoanType: "internal" | "external" | null = null;
  if (params.success) {
    const loan = await db.loan.findUnique({
      where: { id: params.success },
      select: { loanType: true },
    });
    if (loan?.loanType === "external") successLoanType = "external";
    else if (loan) successLoanType = "internal";
  }

  return (
    <LandingClient
      locations={locations}
      selectedLocation={selectedLocation}
      internalBorrowers={internalBorrowers}
      catalog={catalog}
      scanUnits={scanUnits}
      successRef={params.success}
      successLoanType={successLoanType}
      errorMessage={params.error}
      initialMode={initialMode}
    />
  );
}
