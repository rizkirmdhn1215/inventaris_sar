import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { formatTanggalID, STATUS_COLOR } from "@/lib/format";
import { FileText, Printer } from "lucide-react";
import { DocumentEditor } from "./document-editor";

type PeminjamanDetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function PeminjamanDetailPage({
  params,
  searchParams,
}: PeminjamanDetailProps) {
  const { id } = await params;
  const query = await searchParams;
  const session = await verifySession();

  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      loanItems: {
        include: {
          itemUnit: {
            include: {
              item: true,
            },
          },
        },
      },
    },
  });

  if (!loan) notFound();

  const isApproved = loan.status === "approved" || loan.status === "returned";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            Detail Peminjaman
          </h1>
          <p className="text-sm text-zinc-400">
            {loan.borrowerName} · {loan.borrowerDivision}
          </p>
        </div>
        <span
          className={`self-start inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_COLOR[loan.status] ?? ""}`}
        >
          {loan.status}
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-zinc-400">Keperluan</p>
          <p className="text-zinc-100">{loan.purpose}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Tanggal pinjam → rencana kembali</p>
          <p className="text-zinc-100">
            {formatTanggalID(loan.borrowDate)} → {formatTanggalID(loan.expectedReturnDate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Disetujui oleh</p>
          <p className="text-zinc-100">{loan.approvedBy ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Disetujui pada</p>
          <p className="text-zinc-100">{formatTanggalID(loan.approvedAt)}</p>
        </div>
      </div>

      {query.success ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Request berhasil di-approve. Surat PDF sudah di-generate.
        </p>
      ) : null}
      {query.error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {query.error}
        </p>
      ) : null}

      {isApproved ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-wrap gap-2 items-center">
          <FileText className="w-5 h-5 text-orange-400" />
          <span className="text-sm text-zinc-200 flex-1">Surat peminjaman sudah dibuat.</span>
          <Link
            href={`/api/loans/${loan.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white"
          >
            <Printer className="w-3.5 h-3.5" /> Lihat / Cetak Surat
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-medium text-white mb-3">
            Editor Dokumen Surat
          </h2>
          <DocumentEditor
            loanId={loan.id}
            borrowerName={loan.borrowerName}
            adminDefaultName={session?.name ?? "Admin"}
            initialItems={loan.loanItems.map((li) => ({
              loanItemId: li.id,
              itemName: li.itemUnit.item.name,
              qrCode: li.itemUnit.qrCode,
              condition: li.conditionAtBorrow,
            }))}
          />
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-200">
          Daftar Barang
        </div>
        <ul className="divide-y divide-zinc-800">
          {loan.loanItems.map((li) => (
            <li key={li.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-100">{li.itemUnit.item.name}</p>
                <p className="text-xs text-zinc-400 font-mono">{li.itemUnit.qrCode}</p>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_COLOR[li.conditionAtBorrow] ?? "bg-zinc-800 text-zinc-200"}`}>
                {li.conditionAtBorrow}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

