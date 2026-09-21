"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratPeminjamanDocument } from "@/components/pdf/surat-peminjaman";
import { uploadBufferToMinio } from "@/lib/minio";
import { DEFAULT_PENGAWAS_GUDANG } from "@/lib/gudang-signatories";
import { groupLoanItemsForPdf } from "@/lib/inventory";
import { allocateAvailableUnits } from "@/lib/inventory";

export async function approveLoanAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");
  const adminSignerName = String(formData.get("adminSignerName") ?? "").trim();
  const adminSignerNip = String(formData.get("adminSignerNip") ?? "").trim() || null;
  const borrowerSignerName = String(formData.get("borrowerSignerName") ?? "").trim();
  const pengawasGudangName =
    String(formData.get("pengawasGudangName") ?? "").trim() ||
    DEFAULT_PENGAWAS_GUDANG.name;
  const pengawasGudangNip =
    String(formData.get("pengawasGudangNip") ?? "").trim() ||
    DEFAULT_PENGAWAS_GUDANG.nip ||
    null;
  const letterNumber = String(formData.get("letterNumber") ?? "").trim();
  const letterBody = String(formData.get("letterBody") ?? "").trim();
  const orderedLoanItemIdsRaw = String(formData.get("orderedLoanItemIds") ?? "");

  // Signature data URLs (base64 PNG, empty string means none provided)
  const borrowerSignatureDataUrl = String(formData.get("borrowerSignatureDataUrl") ?? "").trim() || null;
  const adminSignatureDataUrl = String(formData.get("adminSignatureDataUrl") ?? "").trim() || null;
  const pengawasSignatureDataUrl = String(formData.get("pengawasSignatureDataUrl") ?? "").trim() || null;
  const borrowerSignatureScale = Number(formData.get("borrowerSignatureDataUrlScale") ?? 100) || 100;
  const adminSignatureScale = Number(formData.get("adminSignatureDataUrlScale") ?? 100) || 100;
  const pengawasSignatureScale = Number(formData.get("pengawasSignatureDataUrlScale") ?? 100) || 100;

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

  // Use borrower signature from DB if not provided in form (pre-filled from loan submission)
  const finalBorrowerSignatureDataUrl =
    borrowerSignatureDataUrl ?? loan!.borrowerSignatureDataUrl ?? null;
  const finalBorrowerSignatureScale =
    borrowerSignatureDataUrl ? borrowerSignatureScale : (loan!.borrowerSignatureScale ?? 100);

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
    const pdfGroupedItems = groupLoanItemsForPdf(sortedItems);
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
        adminSignerNip: adminSignerNip ?? undefined,
        pengawasGudangName,
        pengawasGudangNip: pengawasGudangNip ?? undefined,
        items: pdfGroupedItems,
        // Use compact spacing when item count is small to maximise chance of
        // keeping the signature block on the same page as the content.
        compact: pdfGroupedItems.length <= 6,
        borrowerSignatureDataUrl: finalBorrowerSignatureDataUrl ?? undefined,
        adminSignatureDataUrl: adminSignatureDataUrl ?? undefined,
        pengawasSignatureDataUrl: pengawasSignatureDataUrl ?? undefined,
        borrowerSignatureScale: finalBorrowerSignatureScale,
        adminSignatureScale,
        pengawasSignatureScale,
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
          adminSignerNip,
          pengawasGudangName,
          pengawasGudangNip,
          orderedLoanItemIds,
          pdfUrl: documentUrl,
          // Signature images stored as base64 PNG data URLs
          borrowerSignatureDataUrl: finalBorrowerSignatureDataUrl,
          adminSignatureDataUrl,
          pengawasSignatureDataUrl,
          borrowerSignatureScale: finalBorrowerSignatureScale,
          adminSignatureScale,
          pengawasSignatureScale,
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

export async function denyLoanAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");

  if (!loanId) {
    redirect("/admin/peminjaman?error=Loan%20ID%20tidak%20valid");
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { loanItems: true },
  });

  if (!loan) {
    redirect("/admin/peminjaman?error=Loan%20tidak%20ditemukan");
  }

  await db.$transaction(async (tx) => {
    // Release allocated units back to available
    await tx.itemUnit.updateMany({
      where: {
        id: { in: loan!.loanItems.map((li) => li.itemUnitId) },
        status: "borrowed",
      },
      data: { status: "available" },
    });

    await tx.loan.update({
      where: { id: loanId },
      data: { status: "denied" },
    });
  });

  revalidatePath("/admin/peminjaman");
  redirect(`/admin/peminjaman/${loanId}?success=denied`);
}

export async function deleteLoanAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");

  if (!loanId) {
    redirect("/admin/peminjaman?error=Loan%20ID%20tidak%20valid");
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { loanItems: true },
  });

  if (!loan) {
    redirect("/admin/peminjaman?error=Loan%20tidak%20ditemukan");
  }

  await db.$transaction(async (tx) => {
    // Release units back to available if they were borrowed
    const borrowedUnitIds = loan!.loanItems.map((li) => li.itemUnitId);
    if (borrowedUnitIds.length > 0) {
      await tx.itemUnit.updateMany({
        where: {
          id: { in: borrowedUnitIds },
          status: "borrowed",
        },
        data: { status: "available" },
      });
    }

    // Delete the loan (cascades to loanItems)
    await tx.loan.delete({
      where: { id: loanId },
    });
  });

  revalidatePath("/admin/peminjaman");
  redirect("/admin/peminjaman?success=Peminjaman%20berhasil%20dihapus");
}

export async function updateLoanItemsAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");

  if (!loanId) {
    redirect("/admin/peminjaman?error=Loan%20ID%20tidak%20valid");
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { loanItems: true },
  });

  if (!loan || loan.status !== "pending") {
    redirect(`/admin/peminjaman/${loanId}?error=Hanya%20peminjaman%20berstatus%20Menunggu%20yang%20bisa%20diedit`);
  }

  const borrowItemIds = formData.getAll("borrowItemId").map((v) => String(v));
  const borrowQuantities = formData.getAll("borrowQuantity").map((v) => Number(String(v)));

  const lines = borrowItemIds
    .map((itemId, i) => ({
      itemId,
      quantity: borrowQuantities[i],
    }))
    .filter((l) => l.itemId && Number.isInteger(l.quantity) && l.quantity > 0);

  if (lines.length === 0) {
    redirect(`/admin/peminjaman/${loanId}?error=Pilih%20minimal%201%20barang`);
  }

  // Release old units
  const oldUnitIds = loan.loanItems.map((li) => li.itemUnitId);
  if (oldUnitIds.length > 0) {
    await db.itemUnit.updateMany({
      where: { id: { in: oldUnitIds }, status: "borrowed" },
      data: { status: "available" },
    });
  }

  // Delete old loan items
  await db.loanItem.deleteMany({ where: { loanId } });

  // Allocate new units
  const usedUnitIds: string[] = [];
  const unitsToLoan: { id: string; condition: string }[] = [];

  for (const line of lines) {
    const item = await db.item.findFirst({
      where: { id: line.itemId, locationId: loan.locationId },
      select: { name: true },
    });
    if (!item) {
      redirect(`/admin/peminjaman/${loanId}?error=Barang%20tidak%20valid%20untuk%20lokasi%20ini`);
    }

    const allocated = await allocateAvailableUnits(
      line.itemId,
      line.quantity,
      usedUnitIds
    );
    if (!allocated) {
      redirect(
        `/admin/peminjaman/${loanId}?error=Stok%20${encodeURIComponent(item.name)}%20tidak%20cukup%20(${line.quantity}%20diminta)`
      );
    }
    for (const u of allocated) {
      usedUnitIds.push(u.id);
      unitsToLoan.push(u);
    }
  }

  // Create new loan items
  await db.loanItem.createMany({
    data: unitsToLoan.map((unit) => ({
      loanId,
      itemUnitId: unit.id,
      conditionAtBorrow: unit.condition,
    })),
  });

  revalidatePath(`/admin/peminjaman/${loanId}`);
  revalidatePath("/admin/peminjaman");
  redirect(`/admin/peminjaman/${loanId}?success=updated`);
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
