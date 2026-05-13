"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { sendPushToAllAdmins } from "@/lib/push";

export async function createLoanRequestAction(formData: FormData) {
  const borrowerName = String(formData.get("borrowerName") ?? "").trim();
  const borrowerDivision = String(formData.get("borrowerDivision") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const borrowDate = String(formData.get("borrowDate") ?? "").trim();
  const expectedReturnDate = String(formData.get("expectedReturnDate") ?? "").trim();
  const itemUnitIds = formData.getAll("itemUnitId").map((v) => String(v));

  const loanType =
    String(formData.get("loanType") ?? "internal").trim() === "external"
      ? "external"
      : "internal";
  const instansi = String(formData.get("instansi") ?? "").trim() || null;
  const externalLetterNumber =
    String(formData.get("externalLetterNumber") ?? "").trim() || null;
  const contactPerson = String(formData.get("contactPerson") ?? "").trim() || null;
  const contactVia = String(formData.get("contactVia") ?? "").trim() || null;

  const backPath = loanType === "external" ? "/?mode=external" : "/?mode=pinjam";

  if (
    !borrowerName ||
    !borrowerDivision ||
    !purpose ||
    !borrowDate ||
    !expectedReturnDate
  ) {
    redirect(`${backPath}&error=Lengkapi%20semua%20field%20wajib`);
  }

  if (loanType === "external") {
    if (!instansi || !externalLetterNumber || !contactPerson || !contactVia) {
      redirect(
        `${backPath}&error=Lengkapi%20instansi%2C%20no%20surat%2C%20kontak%20person%2C%20dan%20kontak%20via`
      );
    }
  }

  if (itemUnitIds.length === 0) {
    redirect(`${backPath}&error=Pilih%20minimal%201%20barang`);
  }

  const units = await db.itemUnit.findMany({
    where: { id: { in: itemUnitIds }, status: "available" },
    select: { id: true, condition: true },
  });

  if (units.length !== itemUnitIds.length) {
    redirect(`${backPath}&error=Sebagian%20barang%20sudah%20tidak%20tersedia`);
  }

  const loan = await db.loan.create({
    data: {
      borrowerName,
      borrowerDivision,
      purpose,
      borrowDate: new Date(borrowDate),
      expectedReturnDate: new Date(expectedReturnDate),
      status: "pending",
      loanType,
      instansi,
      externalLetterNumber,
      contactPerson,
      contactVia,
    },
  });

  await db.loanItem.createMany({
    data: units.map((unit) => ({
      loanId: loan.id,
      itemUnitId: unit.id,
      conditionAtBorrow: unit.condition,
    })),
  });

  // Notify all admins (best-effort)
  try {
    await sendPushToAllAdmins({
      title: "Request peminjaman baru",
      body: `${borrowerName} (${borrowerDivision}) mengajukan ${units.length} barang.`,
      url: `/admin/peminjaman/${loan.id}`,
    });
  } catch (err) {
    console.warn("Push notification skipped:", (err as Error).message);
  }

  redirect(`/?success=${loan.id}`);
}

