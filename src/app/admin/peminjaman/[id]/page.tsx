import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";
import { formatTanggalID, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { FileText, Printer, CalendarClock, Building2, XCircle } from "lucide-react";
import { DocumentEditor } from "./document-editor";
import { DeleteLoanButton } from "./delete-loan-button";
import { LoanItemsEditor } from "./loan-items-editor";
import { extendLoanDeadlineAction } from "../actions";
import { getBorrowCatalog } from "@/lib/borrow-catalog";

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

  const currentAdmin = session
    ? await db.admin.findUnique({
        where: { id: session.adminId },
        select: { nip: true },
      })
    : null;

  const loan = await db.loan.findUnique({
    where: { id },
    include: {
      loanItems: {
        include: {
          itemUnit: {
            include: {
              item: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!loan) notFound();

  const isApproved = loan.status === "approved" || loan.status === "returned";
  const isPending = loan.status === "pending";
  const isDenied = loan.status === "denied";
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

  // Prepare data for LoanItemsEditor (only when pending)
  const itemMap = new Map<
    string,
    {
      itemId: string;
      name: string;
      merk: string | null;
      categoryName: string | null;
      quantity: number;
    }
  >();

  for (const li of loan.loanItems) {
    const item = li.itemUnit.item;
    const existing = itemMap.get(item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      itemMap.set(item.id, {
        itemId: item.id,
        name: item.name,
        merk: item.merk,
        categoryName: item.category?.name ?? null,
        quantity: 1,
      });
    }
  }

  const catalog = isPending ? await getBorrowCatalog(loan.locationId) : [];
  const catalogMap = new Map(catalog.map((c) => [c.itemId, c]));

  const editorItems = Array.from(itemMap.values()).map((it) => {
    const cat = catalogMap.get(it.itemId);
    return {
      itemId: it.itemId,
      name: it.name,
      merk: it.merk,
      categoryName: it.categoryName ?? cat?.categoryName ?? null,
      quantity: it.quantity,
      availableCount: Math.max(it.quantity, cat?.availableCount ?? it.quantity),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">
            Detail Peminjaman
          </h1>
          <p className="text-sm text-zinc-400">
            {loan.borrowerName} · {loan.borrowerDivision}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_COLOR[loan.status] ?? ""}`}
          >
            {STATUS_LABEL[loan.status] ?? loan.status}
          </span>
          <DeleteLoanButton loanId={loan.id} borrowerName={loan.borrowerName} />
        </div>
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
          Request berhasil disetujui. Surat PDF sudah dibuat.
        </p>
      ) : null}
      {query.success === "extended" ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Tanggal kembali berhasil diperpanjang.
        </p>
      ) : null}
      {query.success === "updated" ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Daftar barang peminjaman berhasil diperbarui.
        </p>
      ) : null}
      {query.success === "denied" ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          Peminjaman telah ditolak.
        </p>
      ) : null}
      {query.error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {query.error}
        </p>
      ) : null}

      {/* When approved/returned: Show PDF link */}
      {isApproved ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-wrap gap-2 items-center">
          <FileText className="w-5 h-5 text-orange-400" />
          <span className="text-sm text-zinc-200 flex-1">Surat peminjaman sudah dibuat.</span>
          <Link
            href={`/api/loans/${loan.id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium"
          >
            <Printer className="w-3.5 h-3.5" /> Lihat / Cetak Surat
          </Link>
        </div>
      ) : null}

      {/* When denied: Show notice */}
      {isDenied ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/15 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-300">Peminjaman Ditolak</p>
            <p className="text-xs text-zinc-400">
              Permintaan peminjaman ini telah ditolak oleh admin. Unit barang tidak dipinjamkan dan tersedia di gudang.
            </p>
          </div>
        </div>
      ) : null}

      {/* When pending: Admin can edit items/quantities AND preview/approve/deny document */}
      {isPending ? (
        <>
          <LoanItemsEditor
            loanId={loan.id}
            initialItems={editorItems}
            catalog={catalog}
          />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-sm font-medium text-white mb-3">
              Editor Dokumen Surat
            </h2>
            <DocumentEditor
              loanId={loan.id}
              borrowerName={loan.borrowerName}
              adminDefaultName={session?.name ?? "Admin"}
              adminDefaultNip={currentAdmin?.nip}
              defaultLetterNumber={loan.externalLetterNumber ?? undefined}
              borrowerSignatureDataUrl={loan.borrowerSignatureDataUrl}
              borrowerSignatureScale={loan.borrowerSignatureScale}
              initialItems={loan.loanItems.map((li) => ({
                loanItemId: li.id,
                itemName: li.itemUnit.item.name,
                qrCode: li.itemUnit.qrCode,
                condition: li.conditionAtBorrow,
              }))}
            />
          </div>
        </>
      ) : null}

      {/* Extension section for approved loans */}
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

      {/* Daftar barang fisik unit */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-medium text-zinc-200">
          Daftar Unit Fisik Barang ({loan.loanItems.length} unit)
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
          {loan.loanItems.length === 0 ? (
            <li className="p-4 text-center text-xs text-zinc-500">
              Belum ada unit barang yang dialokasikan.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
