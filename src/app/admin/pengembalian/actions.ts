"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/session";
import { uploadBufferToMinio } from "@/lib/minio";

export async function submitReturnAction(formData: FormData) {
  const loanId = String(formData.get("loanId") ?? "");
  const session = await verifySession();
  const checkedBy = session?.name ?? "Petugas";

  if (!loanId) {
    redirect(`/admin/pengembalian?error=Loan%20tidak%20valid`);
  }

  const loan = await db.loan.findUnique({
    where: { id: loanId },
    include: { loanItems: true },
  });
  if (!loan) {
    redirect(`/admin/pengembalian?error=Loan%20tidak%20ditemukan`);
  }

  type ReportInput = {
    itemUnitId: string;
    conditionResult: string;
    severity: string | null;
    damageDescription: string | null;
    photoFiles: File[];
  };

  const reports: ReportInput[] = [];
  for (const li of loan!.loanItems) {
    const condition = String(formData.get(`condition_${li.itemUnitId}`) ?? "good");
    const severity = String(formData.get(`severity_${li.itemUnitId}`) ?? "") || null;
    const damageDescription =
      String(formData.get(`description_${li.itemUnitId}`) ?? "").trim() || null;
    const photoFiles = formData
      .getAll(`photos_${li.itemUnitId}`)
      .filter((v): v is File => v instanceof File && v.size > 0);

    if ((condition === "damaged" || condition === "lost") && !damageDescription) {
      redirect(
        `/admin/pengembalian/${loanId}?error=Deskripsi%20wajib%20untuk%20barang%20rusak/hilang`
      );
    }
    if ((condition === "damaged" || condition === "lost") && photoFiles.length === 0) {
      redirect(
        `/admin/pengembalian/${loanId}?error=Foto%20wajib%20untuk%20barang%20rusak/hilang`
      );
    }

    reports.push({
      itemUnitId: li.itemUnitId,
      conditionResult: condition,
      severity,
      damageDescription,
      photoFiles,
    });
  }

  // Upload photos
  const bucket = process.env.MINIO_BUCKET_PHOTOS || "condition-photos";
  const uploadedReports: Array<ReportInput & { photoUrls: string[] }> = [];
  for (const report of reports) {
    const photoUrls: string[] = [];
    for (const [idx, file] of report.photoFiles.entries()) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const objectName = `${loanId}/${report.itemUnitId}-${Date.now()}-${idx}-${safeName}`;
        const result = await uploadBufferToMinio({
          bucketName: bucket,
          objectName,
          buffer,
          contentType: file.type || "image/jpeg",
        });
        photoUrls.push(result.publicUrl);
      } catch (e) {
        console.warn("Photo upload skipped:", (e as Error).message);
      }
    }
    uploadedReports.push({ ...report, photoUrls });
  }

  await db.$transaction(async (tx) => {
    const check = await tx.returnCheck.create({
      data: { loanId, checkedBy },
    });

    await tx.conditionReport.createMany({
      data: uploadedReports.map((report) => ({
        returnCheckId: check.id,
        itemUnitId: report.itemUnitId,
        conditionResult: report.conditionResult,
        damageDescription: report.damageDescription,
        severity: report.severity,
        photoUrls: report.photoUrls,
      })),
    });

    for (const report of uploadedReports) {
      await tx.itemUnit.update({
        where: { id: report.itemUnitId },
        data: {
          status: "available",
          condition: report.conditionResult,
        },
      });
    }

    await tx.loan.update({
      where: { id: loanId },
      data: { status: "returned" },
    });
  });

  revalidatePath("/admin/pengembalian");
  redirect("/admin/pengembalian?success=returned");
}
