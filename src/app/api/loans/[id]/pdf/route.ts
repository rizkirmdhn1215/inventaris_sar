import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratPeminjamanDocument } from "@/components/pdf/surat-peminjaman";
import { verifySession } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      loanItems: { include: { itemUnit: { include: { item: true } } } },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  let meta: {
    letterNumber?: string;
    letterBody?: string;
    borrowerSignerName?: string;
    adminSignerName?: string;
    orderedLoanItemIds?: string[];
  } = {};
  try {
    meta = loan.documentUrl ? JSON.parse(loan.documentUrl) : {};
  } catch {
    meta = {};
  }

  const orderMap = new Map(
    (meta.orderedLoanItemIds ?? []).map((iid, idx) => [iid, idx])
  );
  const items = [...loan.loanItems].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const year = new Date().getFullYear();
  const buffer = await renderToBuffer(
    SuratPeminjamanDocument({
      letterNumber: meta.letterNumber || `SAR/INV/${year}/001`,
      letterBody: meta.letterBody || "",
      borrowerName: loan.borrowerName,
      borrowerDivision: loan.borrowerDivision,
      purpose: loan.purpose,
      borrowDate: loan.borrowDate,
      expectedReturnDate: loan.expectedReturnDate,
      borrowerSignerName: meta.borrowerSignerName || loan.borrowerName,
      adminSignerName: meta.adminSignerName || loan.approvedBy || session.name,
      items: items.map((li) => ({
        itemName: li.itemUnit.item.name,
        qrCode: li.itemUnit.qrCode,
        condition: li.conditionAtBorrow,
      })),
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat-${loan.id}.pdf"`,
    },
  });
}
