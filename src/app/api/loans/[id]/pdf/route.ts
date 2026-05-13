import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratPeminjamanDocument } from "@/components/pdf/surat-peminjaman";
import { verifySession } from "@/lib/auth/session";

async function loadKopImage(): Promise<Buffer | null> {
  const candidates = ["kop-surat.png", "kop-surat.jpg", "kop-surat.jpeg"];
  for (const name of candidates) {
    try {
      const filePath = path.join(process.cwd(), "public", name);
      return await readFile(filePath);
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = new URL(req.url);
  const isDraft = url.searchParams.get("draft") === "1";

  // Drafts are accessible to anyone with the loan ID (CUID is unguessable).
  // Final letters require an admin session.
  const session = await verifySession();
  if (!isDraft && !session) {
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

  // Auto-increment letter number based on the loan's chronological position
  // among all loans created in the same calendar year.
  const loanYear = loan.createdAt.getFullYear();
  const yearStart = new Date(loanYear, 0, 1);
  const earlierThisYear = await db.loan.count({
    where: {
      createdAt: { gte: yearStart, lte: loan.createdAt },
    },
  });
  const autoLetterNumber = `SAR.PP/INV/${loanYear}/${String(earlierThisYear).padStart(3, "0")}`;

  const kopImage = await loadKopImage();
  const buffer = await renderToBuffer(
    SuratPeminjamanDocument({
      letterNumber: meta.letterNumber || autoLetterNumber,
      letterBody: meta.letterBody || "",
      borrowerName: loan.borrowerName,
      borrowerDivision: loan.borrowerDivision,
      purpose: loan.purpose,
      borrowDate: loan.borrowDate,
      expectedReturnDate: loan.expectedReturnDate,
      borrowerSignerName: meta.borrowerSignerName || loan.borrowerName,
      adminSignerName:
        meta.adminSignerName ||
        loan.approvedBy ||
        session?.name ||
        "(Belum disetujui)",
      items: items.map((li) => ({
        itemName: li.itemUnit.item.name,
        qrCode: li.itemUnit.qrCode,
        condition: li.conditionAtBorrow,
      })),
      kopImage,
      isDraft,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="surat${isDraft ? "-draft" : ""}-${loan.id}.pdf"`,
    },
  });
}
