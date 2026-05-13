import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { formatTanggalID, STATUS_COLOR } from "@/lib/format";
import { FileText, Printer, CalendarClock, Building2 } from "lucide-react";
import { DocumentEditor } from "./document-editor";
import { extendLoanDeadlineAction } from "../actions";

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
  const isExternal = loan.loanType === "external";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(loan.expectedReturnDate);
  expected.setHours(0, 0, 0, 0);
  const isOverdue = isApproved && loan.status !== "returned" && expected < today;
  const minNewDate = new Date(expected);
  minNewDate.setDate(minNewDate.getDate() + 1);
  const minNewDateStr = minNewDate.toISOString().slice(0, 10);
  const suggestedDate = new Date(today);
  suggestedDate.setDate(today.getDate() + 7);
  const suggestedDateStr =
    suggestedDate > minNewDate
      ? suggestedDate.toISOString().slice(0, 10)
      : minNewDateStr;

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

      {isExternal ? (
        <div className="rounded-2xl border border-orange-900/40 bg-orange-950/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="sm:col-span-2 flex items-center gap-2 text-orange-300 font-medium">
            <Building2 className="w-4 h-4" />
            Peminjaman Eksternal
          </div>
          <div>
            <p className="text-xs text-zinc-400">Instansi</p>
            <p className="text-zinc-100">{loan.instansi ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">No. Surat</p>
            <p className="text-zinc-100 font-mono">{loan.externalLetterNumber ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Contact Person</p>
            <p className="text-zinc-100">{loan.contactPerson ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Kontak via</p>
            <p className="text-zinc-100">{loan.contactVia ?? "-"}</p>
          </div>
        </div>
      ) : null}

      {query.success === "approved" ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Request berhasil di-approve. Surat PDF sudah di-generate.
        </p>
      ) : null}
      {query.success === "extended" ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Tanggal kembali berhasil diperpanjang.
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
            defaultLetterNumber={loan.externalLetterNumber ?? undefined}
            initialItems={loan.loanItems.map((li) => ({
              loanItemId: li.id,
              itemName: li.itemUnit.item.name,
              qrCode: li.itemUnit.qrCode,
              condition: li.conditionAtBorrow,
            }))}
          />
        </div>
      )}

      {isApproved && loan.status !== "returned" ? (
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            isOverdue
              ? "border-red-900/50 bg-red-950/20"
              : "border-zinc-800 bg-zinc-900/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarClock
              className={`w-5 h-5 ${isOverdue ? "text-red-400" : "text-orange-400"}`}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                Perpanjang Tanggal Kembali
              </p>
              <p className="text-xs text-zinc-400">
                Rencana saat ini: {formatTanggalID(loan.expectedReturnDate)}
                {isOverdue ? " · sudah lewat dari tanggal hari ini" : ""}
                {loan.extendedCount > 0
                  ? ` · sudah diperpanjang ${loan.extendedCount}x`
                  : ""}
              </p>
            </div>
          </div>

          <form
            action={extendLoanDeadlineAction}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            <input type="hidden" name="loanId" value={loan.id} />
            <label className="text-xs text-zinc-400 space-y-1">
              Tanggal kembali baru
              <input
                type="date"
                name="newReturnDate"
                required
                min={minNewDateStr}
                defaultValue={suggestedDateStr}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </label>
            <input
              name="extendReason"
              placeholder="Alasan perpanjangan (opsional)"
              className="sm:col-span-2 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="sm:col-span-3 justify-self-start rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
            >
              Perpanjang
            </button>
          </form>
        </div>
      ) : null}

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

