import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifySession } from "@/lib/auth/session";
import { resolveAdminScope } from "@/lib/location-scope";
import {
  LaporanInventarisDocument,
  type LaporanInventarisRow,
} from "@/components/pdf/laporan-inventaris";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

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

async function generatePdfResponse({
  session,
  typeParam,
  lokasiParam,
  bulanParam,
  tahunParam,
  searchParam,
  signerNameParam,
  signerNipParam,
  pengawasNameParam,
  pengawasNipParam,
  petugasSignatureDataUrl,
  pengawasSignatureDataUrl,
  customRows,
  customTitle,
  customDocNumber,
  customPeriodLabel,
  senderSignerName,
  senderSignatureDataUrl,
}: {
  session: { adminId: string; role: string; name?: string };
  typeParam: "in" | "out";
  lokasiParam?: string | null;
  bulanParam: string;
  tahunParam: string;
  searchParam?: string;
  signerNameParam?: string;
  signerNipParam?: string;
  pengawasNameParam?: string;
  pengawasNipParam?: string;
  petugasSignatureDataUrl?: string | null;
  pengawasSignatureDataUrl?: string | null;
  customRows?: LaporanInventarisRow[];
  customTitle?: string;
  customDocNumber?: string;
  customPeriodLabel?: string;
  senderSignerName?: string;
  senderSignatureDataUrl?: string | null;
}) {
  const scope = await resolveAdminScope(
    { adminId: session.adminId, role: session.role },
    lokasiParam
  );

  const isIncoming = typeParam === "in";
  let rows: LaporanInventarisRow[];

  if (Array.isArray(customRows)) {
    rows = customRows;
  } else {
    const where: any = {
      locationId: scope.locationId,
      type: typeParam,
    };

    if (tahunParam !== "all" && !Number.isNaN(Number(tahunParam))) {
      const y = Number(tahunParam);
      if (bulanParam !== "all" && !Number.isNaN(Number(bulanParam))) {
        const m = Number(bulanParam) - 1;
        const startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
        where.createdAt = { gte: startDate, lte: endDate };
      } else {
        const startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
        where.createdAt = { gte: startDate, lte: endDate };
      }
    }

    if (searchParam) {
      where.OR = [
        { transactionCode: { contains: searchParam, mode: "insensitive" } },
        { item: { name: { contains: searchParam, mode: "insensitive" } } },
        { referenceNo: { contains: searchParam, mode: "insensitive" } },
        { recipient: { contains: searchParam, mode: "insensitive" } },
        { sender: { contains: searchParam, mode: "insensitive" } },
        { notes: { contains: searchParam, mode: "insensitive" } },
      ];
    }

    const transactions = await db.itemTransaction.findMany({
      where,
      include: {
        item: {
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    rows = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt.toISOString().slice(0, 10),
      noRef: t.referenceNo || "-",
      itemName: t.item?.name ?? "Barang",
      category: t.item?.category?.name ?? "-",
      qty: t.quantity,
      sourceOrReason: t.source || (isIncoming ? "Pengadaan Baru" : "Pengeluaran"),
      sender: t.sender || "",
      recipient: t.recipient || "",
      target: t.sender || "",
      notes: t.notes ?? "",
      qrCodes: t.qrCodes,
    }));
  }

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

  // Periode label
  let periodLabel = customPeriodLabel || "Semua Periode";
  if (!customPeriodLabel) {
    if (bulanParam !== "all" && tahunParam !== "all") {
      const monthName = MONTH_NAMES[Number(bulanParam) - 1] ?? "";
      periodLabel = `${monthName} ${tahunParam}`;
    } else if (bulanParam !== "all") {
      const monthName = MONTH_NAMES[Number(bulanParam) - 1] ?? "";
      periodLabel = `Bulan ${monthName}`;
    } else if (tahunParam !== "all") {
      periodLabel = `Tahun ${tahunParam}`;
    }
  }

  const typeText = isIncoming ? "BARANG MASUK" : "BARANG KELUAR";
  const title = customTitle || `SURAT LAPORAN ${typeText} ${periodLabel.toUpperCase()}`;
  const now = new Date();
  const yearNow = now.getFullYear();
  const romanMonth = ROMAN_MONTHS[now.getMonth()] ?? "I";
  const docNumber =
    customDocNumber ||
    `01/${isIncoming ? "M" : "K"}/PL.01.02/${romanMonth}/GDG SAR PDG-${yearNow}`;

  const kopImage = await loadKopImage();

  const buffer = await renderToBuffer(
    LaporanInventarisDocument({
      type: typeParam,
      title,
      docNumber,
      locationName: scope.activeLocation.name,
      periodLabel,
      totalTransactions: rows.length,
      totalQty,
      rows,
      signerName: signerNameParam || session.name || "Petugas Gudang SAR",
      signerNip: signerNipParam || undefined,
      pengawasName: pengawasNameParam || DEFAULT_PENGAWAS_GUDANG.name,
      pengawasNip: pengawasNipParam || DEFAULT_PENGAWAS_GUDANG.nip,
      kopImage,
      petugasSignatureDataUrl,
      pengawasSignatureDataUrl,
      senderSignerName,
      senderSignatureDataUrl,
    })
  );

  const fileSlug = `laporan-${isIncoming ? "barang-masuk" : "barang-keluar"}-${tahunParam}-${bulanParam}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileSlug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  return generatePdfResponse({
    session,
    typeParam: url.searchParams.get("type") === "out" ? "out" : "in",
    lokasiParam: url.searchParams.get("lokasi"),
    bulanParam: url.searchParams.get("bulan") ?? "all",
    tahunParam: url.searchParams.get("tahun") ?? "all",
    searchParam: url.searchParams.get("search")?.trim() ?? "",
    signerNameParam: url.searchParams.get("petugas")?.trim(),
    signerNipParam: url.searchParams.get("nip")?.trim(),
    pengawasNameParam: url.searchParams.get("pengawas")?.trim(),
    pengawasNipParam: url.searchParams.get("pengawasNip")?.trim(),
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  return generatePdfResponse({
    session,
    typeParam: body.type === "out" ? "out" : "in",
    lokasiParam: body.lokasi,
    bulanParam: body.bulan ?? "all",
    tahunParam: body.tahun ?? "all",
    searchParam: body.search?.trim() ?? "",
    signerNameParam: body.petugas?.trim(),
    signerNipParam: body.nip?.trim(),
    pengawasNameParam: body.pengawas?.trim(),
    pengawasNipParam: body.pengawasNip?.trim(),
    petugasSignatureDataUrl: body.petugasSignatureDataUrl || null,
    pengawasSignatureDataUrl: body.pengawasSignatureDataUrl || null,
    customRows: Array.isArray(body.customRows) ? body.customRows : undefined,
    customTitle: body.customTitle?.trim() || undefined,
    customDocNumber: body.customDocNumber?.trim() || undefined,
    customPeriodLabel: body.customPeriodLabel?.trim() || undefined,
    senderSignerName: body.pengirim !== undefined ? String(body.pengirim).trim() : undefined,
    senderSignatureDataUrl: body.pengirimSignatureDataUrl || null,
  });
}
