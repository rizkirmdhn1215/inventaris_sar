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

  if (
    !borrowerName ||
    !borrowerDivision ||
    !purpose ||
    !borrowDate ||
    !expectedReturnDate
  ) {
    redirect("/pinjam?error=Lengkapi%20semua%20field%20wajib");
  }

  if (itemUnitIds.length === 0) {
    redirect("/pinjam?error=Pilih%20minimal%201%20barang");
  }

  const units = await db.itemUnit.findMany({
    where: { id: { in: itemUnitIds }, status: "available" },
    select: { id: true, condition: true },
  });

  if (units.length !== itemUnitIds.length) {
    redirect("/pinjam?error=Sebagian%20barang%20sudah%20tidak%20tersedia");
  }

  const loan = await db.loan.create({
    data: {
      borrowerName,
      borrowerDivision,
      purpose,
      borrowDate: new Date(borrowDate),
      expectedReturnDate: new Date(expectedReturnDate),
      status: "pending",
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

