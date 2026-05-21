import { listInternalBorrowers } from "@/lib/internal-borrowers";
import { getBorrowCatalog, getScannableUnits } from "@/lib/borrow-catalog";
import { LandingClient } from "./landing-client";

type HomeProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    mode?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const [catalog, scanUnits] = await Promise.all([
    getBorrowCatalog(),
    getScannableUnits(),
  ]);

  const initialMode: "none" | "pinjam" | "external" =
    params.mode === "pinjam" || params.mode === "external" ? params.mode : "none";

  const internalBorrowers = await listInternalBorrowers();

  return (
    <LandingClient
      internalBorrowers={internalBorrowers}
      catalog={catalog}
      scanUnits={scanUnits}
      successRef={params.success}
      errorMessage={params.error}
      initialMode={initialMode}
    />
  );
}
