"use server";

import { db } from "@/lib/db";
import { rememberInternalBorrower } from "@/lib/internal-borrowers";
import { redirect } from "next/navigation";
import { sendPushToLocationAdmins } from "@/lib/push";
import { allocateAvailableUnits } from "@/lib/inventory";
import { resolveLoanLocationFromForm } from "@/lib/resolve-loan-location";

export async function createLoanRequestAction(formData: FormData) {
  const borrowerName = String(formData.get("borrowerName") ?? "").trim();
  const borrowerDivision = String(formData.get("borrowerDivision") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const borrowDate = String(formData.get("borrowDate") ?? "").trim();
  const expectedReturnDate = String(formData.get("expectedReturnDate") ?? "").trim();

  const loanType =
    String(formData.get("loanType") ?? "internal").trim() === "external"
      ? "external"
      : "internal";
  const instansi = String(formData.get("instansi") ?? "").trim() || null;
  const externalLetterNumber =
    String(formData.get("externalLetterNumber") ?? "").trim() || null;
  const contactPerson = String(formData.get("contactPerson") ?? "").trim() || null;
  const contactVia = String(formData.get("contactVia") ?? "").trim() || null;
  const internalBorrowerId =
    String(formData.get("internalBorrowerId") ?? "").trim() || null;

  const resolved = await resolveLoanLocationFromForm(formData);
  const lokasiQs = resolved ? `&lokasi=${encodeURIComponent(resolved.slug)}` : "";
  const backPath =
    (loanType === "external" ? "/?mode=external" : "/?mode=pinjam") + lokasiQs;

  if (!resolved) {
    redirect("/?error=Pilih%20lokasi%20gudang%20terlebih%20dahulu");
  }

  const locationId = resolved.id;

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

  const borrowItemIds = formData.getAll("borrowItemId").map((v) => String(v));
  const borrowQuantities = formData.getAll("borrowQuantity").map((v) => Number(String(v)));

  const lines = borrowItemIds
    .map((itemId, i) => ({
      itemId,
      quantity: borrowQuantities[i],
    }))
    .filter((l) => l.itemId && Number.isInteger(l.quantity) && l.quantity > 0);

  if (lines.length === 0) {
    redirect(`${backPath}&error=Pilih%20minimal%201%20barang`);
  }

  const usedUnitIds: string[] = [];
  const unitsToLoan: { id: string; condition: string }[] = [];

  for (const line of lines) {
    const item = await db.item.findFirst({
      where: { id: line.itemId, locationId },
      select: { name: true },
    });
    if (!item) {
      redirect(`${backPath}&error=Barang%20tidak%20valid%20untuk%20lokasi%20ini`);
    }

    const allocated = await allocateAvailableUnits(
      line.itemId,
      line.quantity,
      usedUnitIds
    );
    if (!allocated) {
      redirect(
        `${backPath}&error=Stok%20${encodeURIComponent(item.name)}%20tidak%20cukup%20(${line.quantity}%20diminta)`
      );
    }
    for (const u of allocated) {
      usedUnitIds.push(u.id);
      unitsToLoan.push(u);
    }
  }

  const loan = await db.loan.create({
    data: {
      locationId,
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
    data: unitsToLoan.map((unit) => ({
      loanId: loan.id,
      itemUnitId: unit.id,
      conditionAtBorrow: unit.condition,
    })),
  });

  if (loanType === "internal") {
    await rememberInternalBorrower({
      locationId,
      borrowerId: internalBorrowerId,
      name: borrowerName,
      division: borrowerDivision,
    });
  }

  const totalUnits = unitsToLoan.length;
  try {
    await sendPushToLocationAdmins(locationId, {
      title: "Request peminjaman baru",
      body: `${borrowerName} (${borrowerDivision}) mengajukan ${totalUnits} unit barang.`,
      url: `/admin/peminjaman/${loan.id}`,
    });
  } catch (err) {
    console.warn("Push notification skipped:", (err as Error).message);
  }

  const modeQs = loanType === "external" ? "&mode=external" : "&mode=pinjam";
  redirect(`/?success=${loan.id}${lokasiQs}${modeQs}`);
}
