import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const unit = await db.itemUnit.findUnique({
    where: { qrCode: code },
    include: {
      item: true,
      loanItems: {
        where: { loan: { status: "approved" } },
        include: { loan: true },
        take: 1,
      },
    },
  });

  if (!unit) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const activeLoan = unit.loanItems[0]?.loan ?? null;

  return NextResponse.json({
    qrCode: unit.qrCode,
    itemName: unit.item.name,
    status: unit.status,
    condition: unit.condition,
    loanId: activeLoan?.id ?? null,
    borrowerName: activeLoan?.borrowerName ?? null,
  });
}
