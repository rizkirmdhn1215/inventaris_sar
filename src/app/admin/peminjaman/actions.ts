"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratPeminjamanDocument } from "@/components/pdf/surat-peminjaman";
import { uploadBufferToMinio } from "@/lib/minio";

export async function approveLoanAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");
  const adminSignerName = String(formData.get("adminSignerName") ?? "").trim();
  const borrowerSignerName = String(formData.get("borrowerSignerName") ?? "").trim();
  const kepalaGudangName = String(formData.get("kepalaGudangName") ?? "").trim() || "ALVIZAN Z., S.H.";
  const letterNumber = String(formData.get("letterNumber") ?? "").trim();
  const letterBody = String(formData.get("letterBody") ?? "").trim();
  const orderedLoanItemIdsRaw = String(formData.get("orderedLoanItemIds") ?? "");

  if (!loanId || !adminSignerName || !borrowerSignerName || !letterNumber) {
    redirect(`/admin/peminjaman/${loanId}?error=Field%20dokumen%20wajib%20diisi`);
  }

  const orderedLoanItemIds = orderedLoanItemIdsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: {
      loanItems: {
        include: { itemUnit: { include: { item: true } } },
      },
    },
  });

  if (!loan) {
    redirect("/admin/peminjaman?error=Loan%20tidak%20ditemukan");
  }

  // Sort items by orderedLoanItemIds preference
  const orderMap = new Map(orderedLoanItemIds.map((id, idx) => [id, idx]));
  const sortedItems = [...loan!.loanItems].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  // Generate PDF
  let documentUrl: string | null = null;
  try {
    const pdfBuffer = await renderToBuffer(
      SuratPeminjamanDocument({
        letterNumber,
        letterBody,
        borrowerName: loan!.borrowerName,
        borrowerDivision: loan!.borrowerDivision,
        purpose: loan!.purpose,
        borrowDate: loan!.borrowDate,
        expectedReturnDate: loan!.expectedReturnDate,
        borrowerSignerName,
        adminSignerName,
        kepalaGudangName,
        items: sortedItems.map((li) => ({
          itemName: li.itemUnit.item.name,
          qrCode: li.itemUnit.qrCode,
          condition: li.conditionAtBorrow,
        })),
      })
    );

    const bucket = process.env.MINIO_BUCKET_DOCS || "loan-documents";
    const objectName = `surat/${loan!.id}.pdf`;
    try {
      const result = await uploadBufferToMinio({
        bucketName: bucket,
        objectName,
        buffer: pdfBuffer,
        contentType: "application/pdf",
      });
      documentUrl = result.publicUrl;
    } catch (e) {
      console.warn("MinIO PDF upload skipped:", (e as Error).message);
      // Fall back: store inline PDF as base64 data URL is too large; keep null and fetch on demand from DB? Simplest: store nothing, regenerate on download.
    }
  } catch (e) {
    console.error("PDF generation failed:", e);
    redirect(`/admin/peminjaman/${loanId}?error=Gagal%20generate%20PDF`);
  }

  await db.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status: "approved",
        approvedBy: adminSignerName,
        approvedAt: new Date(),
        documentUrl: JSON.stringify({
          version: 2,
          letterNumber,
          letterBody,
          borrowerSignerName,
          adminSignerName,
          kepalaGudangName,
          orderedLoanItemIds,
          pdfUrl: documentUrl,
        }),
      },
    });

    await tx.itemUnit.updateMany({
      where: {
        id: { in: loan!.loanItems.map((li) => li.itemUnitId) },
      },
      data: { status: "borrowed" },
    });
  });

  revalidatePath("/admin/peminjaman");
  redirect(`/admin/peminjaman/${loanId}?success=approved`);
}

export async function extendLoanDeadlineAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");
  const newDate = String(formData.get("newReturnDate") ?? "").trim();
  const reason = String(formData.get("extendReason") ?? "").trim();

  if (!loanId || !newDate) {
    redirect(`/admin/peminjaman/${loanId}?error=Tanggal%20baru%20wajib%20diisi`);
  }

  const loan = await db.loan.findUnique({ where: { id: loanId } });
  if (!loan) {
    redirect("/admin/peminjaman?error=Loan%20tidak%20ditemukan");
  }

  const parsed = new Date(newDate);
  if (Number.isNaN(parsed.getTime())) {
    redirect(`/admin/peminjaman/${loanId}?error=Tanggal%20tidak%20valid`);
  }
  if (parsed <= loan!.expectedReturnDate) {
    redirect(
      `/admin/peminjaman/${loanId}?error=Tanggal%20baru%20harus%20setelah%20rencana%20kembali%20saat%20ini`
    );
  }

  await db.loan.update({
    where: { id: loanId },
    data: {
      expectedReturnDate: parsed,
      extendedCount: { increment: 1 },
      purpose: reason
        ? `${loan!.purpose}\n\n[Perpanjangan ${new Date()
            .toISOString()
            .slice(0, 10)}] ${reason}`
        : loan!.purpose,
    },
  });

  revalidatePath(`/admin/peminjaman/${loanId}`);
  revalidatePath("/admin/peminjaman");
  redirect(`/admin/peminjaman/${loanId}?success=extended`);
}
