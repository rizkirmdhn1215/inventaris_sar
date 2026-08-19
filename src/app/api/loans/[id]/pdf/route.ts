import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratPeminjamanDocument } from "@/components/pdf/surat-peminjaman";
import { verifySession } from "@/lib/auth/session";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";
import { groupLoanItemsForPdf } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadKopImage(): Promise<Buffer | null> {
  const candidates = ["kop-surat.png", "kop-surat.jpg", "kop-surat.jpeg", "logo.png"];
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

  const session = await verifySession();
  if (!isDraft && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
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
      adminSignerNip?: string;
      pengawasGudangName?: string;
      pengawasGudangNip?: string;
      kepalaGudangName?: string;
      orderedLoanItemIds?: string[];
      borrowerSignatureDataUrl?: string | null;
      adminSignatureDataUrl?: string | null;
      pengawasSignatureDataUrl?: string | null;
      borrowerSignatureScale?: number;
      adminSignatureScale?: number;
      pengawasSignatureScale?: number;
    } = {};
    try {
      meta = loan.documentUrl ? JSON.parse(loan.documentUrl) : {};
    } catch {
      meta = {};
    }

    const orderMap = new Map(
      (meta.orderedLoanItemIds ?? []).map((iid, idx) => [iid, idx])
    );
    const sortedLoanItems = [...loan.loanItems].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });

    const loanYear = loan.createdAt.getFullYear();
    const yearStart = new Date(loanYear, 0, 1);
    const earlierThisYear = await db.loan.count({
      where: {
        createdAt: { gte: yearStart, lte: loan.createdAt },
      },
    });
    const autoLetterNumber = `SAR.PP/INV/${loanYear}/${String(earlierThisYear).padStart(3, "0")}`;
    const resolvedLetterNumber =
      meta.letterNumber || loan.externalLetterNumber || autoLetterNumber;

    let pdfItems = groupLoanItemsForPdf(sortedLoanItems);
    if (pdfItems.length === 0) {
      pdfItems = [
        {
          itemName: "(Belum ada barang terlampir)",
          quantity: 0,
          merk: null,
          condition: "-",
        },
      ];
    }

    const kopImage = await loadKopImage();
    const buffer = await renderToBuffer(
      SuratPeminjamanDocument({
        letterNumber: resolvedLetterNumber,
        letterBody:
          meta.letterBody ||
          (isDraft
            ? "Barang dipinjam untuk keperluan operasional SAR dan wajib dikembalikan dalam kondisi baik."
            : ""),
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
        adminSignerNip: meta.adminSignerNip || undefined,
        pengawasGudangName:
          meta.pengawasGudangName ||
          meta.kepalaGudangName ||
          DEFAULT_PENGAWAS_GUDANG.name,
        pengawasGudangNip:
          meta.pengawasGudangNip || DEFAULT_PENGAWAS_GUDANG.nip || undefined,
        items: pdfItems,
        kopImage,
        isDraft,
        compact: pdfItems.length <= 6,
        borrowerSignatureDataUrl: meta.borrowerSignatureDataUrl ?? undefined,
        adminSignatureDataUrl: meta.adminSignatureDataUrl ?? undefined,
        pengawasSignatureDataUrl: meta.pengawasSignatureDataUrl ?? undefined,
        borrowerSignatureScale: meta.borrowerSignatureScale,
        adminSignatureScale: meta.adminSignatureScale,
        pengawasSignatureScale: meta.pengawasSignatureScale,
      })
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="surat${isDraft ? "-draft" : ""}-${loan.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      {
        error: "Gagal membuat PDF",
        detail: process.env.NODE_ENV === "development" ? String(err) : undefined,
      },
      { status: 500 }
    );
  }
}
