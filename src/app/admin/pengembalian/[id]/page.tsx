import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { submitReturnAction } from "../actions";
import { ReturnForm } from "./return-form";

type PengembalianDetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PengembalianDetailPage({
  params,
  searchParams,
}: PengembalianDetailProps) {
  const { id } = await params;
  const query = await searchParams;

  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      loanItems: {
        include: { itemUnit: { include: { item: true } } },
      },
    },
  });

  if (!loan) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">
          Form Pengembalian
        </h1>
        <p className="text-sm text-zinc-400">
          {loan.borrowerName} · {loan.borrowerDivision}
        </p>
      </div>

      {query.error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {query.error}
        </p>
      ) : null}

      <ReturnForm
        loanId={loan.id}
        action={submitReturnAction}
        items={loan.loanItems.map((li) => ({
          itemUnitId: li.itemUnitId,
          itemName: li.itemUnit.item.name,
          qrCode: li.itemUnit.qrCode,
          conditionAtBorrow: li.conditionAtBorrow,
        }))}
      />
    </div>
  );
}
