import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { parseLoanLogFilters } from "@/lib/loan-filters";
import { resolveAdminScope } from "@/lib/location-scope";
import { groupLoanItemsForPdf } from "@/lib/inventory";
import { RekapPeminjamanDocument } from "@/components/pdf/rekap-peminjaman";

const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatItemSummary(
  loanItems: {
    itemUnit: { item: { id: string; name: string; merk?: string | null } };
    conditionAtBorrow: string;
  }[]
) {
  return groupLoanItemsForPdf(loanItems)
    .map((g) => `${g.itemName} (${g.quantity})`)
    .join(", ");
}

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = await resolveAdminScope(
    { adminId: session.adminId, role: session.role },
    url.searchParams.get("lokasi")
  );

  const { monthFilter, peminjamFilter, barangFilter, statusFilter, where } =
    parseLoanLogFilters(
      {
        bulan: url.searchParams.get("bulan") ?? undefined,
        peminjam: url.searchParams.get("peminjam") ?? undefined,
        barang: url.searchParams.get("barang") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        lokasi: url.searchParams.get("lokasi") ?? undefined,
      },
      scope.locationId
    );

  const [yStr, mStr] = monthFilter.split("-");
  const periodLabel = `${ID_MONTHS[Number(mStr) - 1]} ${yStr}`;

  const filterParts: string[] = [
    `Lokasi ${scope.activeLocation.name}`,
    `Bulan ${periodLabel}`,
  ];
  if (peminjamFilter) filterParts.push(`Peminjam: ${peminjamFilter}`);
  if (barangFilter) filterParts.push(`Barang: ${barangFilter}`);
  if (statusFilter) filterParts.push(`Status: ${statusFilter}`);
  if (filterParts.length === 1) filterParts.push("Semua peminjam & barang");

  const loans = await db.loan.findMany({
    where,
    include: {
      loanItems: {
        include: { itemUnit: { include: { item: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const buffer = await renderToBuffer(
    RekapPeminjamanDocument({
      periodLabel,
      filterSummary: filterParts.join(" · "),
      generatedAt: new Date(),
      totalLoans: loans.length,
      rows: loans.map((loan) => ({
        borrowerName: loan.borrowerName,
        borrowerDivision: loan.borrowerDivision,
        borrowDate: loan.borrowDate,
        expectedReturnDate: loan.expectedReturnDate,
        status: loan.status,
        itemSummary: formatItemSummary(loan.loanItems),
        purpose: loan.purpose,
      })),
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rekap-peminjaman-${monthFilter}.pdf"`,
    },
  });
}
