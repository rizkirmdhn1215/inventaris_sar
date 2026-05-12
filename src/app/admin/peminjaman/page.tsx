import Link from "next/link";
import { db } from "@/lib/db";
import { STATUS_COLOR } from "@/lib/format";

type PeminjamanPageProps = {
  searchParams: Promise<{ success?: string; error?: string; status?: string }>;
};

const STATUS_TABS = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
];

export default async function PeminjamanPage({
  searchParams,
}: PeminjamanPageProps) {
  const params = await searchParams;
  const statusFilter =
    params.status && ["pending", "approved", "returned"].includes(params.status)
      ? params.status
      : null;

  const loans = await db.loan.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      loanItems: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Peminjaman</h1>
        <p className="text-sm text-zinc-400">
          Review request, edit dokumen, lalu approve.
        </p>
      </div>

      {params.success ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Request berhasil di-approve.
        </p>
      ) : null}
      {params.error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
          {params.error}
        </p>
      ) : null}

      <div className="flex gap-2 border-b border-zinc-800 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = (statusFilter ?? "") === tab.value;
          const href = tab.value
            ? `/admin/peminjaman?status=${tab.value}`
            : `/admin/peminjaman`;
          return (
            <Link
              key={tab.value || "all"}
              href={href}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 ${
                isActive
                  ? "border-orange-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-zinc-400">Peminjam</th>
              <th className="px-4 py-2 text-left text-zinc-400">Divisi</th>
              <th className="px-4 py-2 text-left text-zinc-400">Jumlah</th>
              <th className="px-4 py-2 text-left text-zinc-400">Status</th>
              <th className="px-4 py-2 text-right text-zinc-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr
                key={loan.id}
                className="border-b border-zinc-800/70 last:border-0 hover:bg-zinc-800/30 cursor-pointer"
              >
                <td className="px-4 py-2 text-zinc-100">
                  <Link
                    href={`/admin/peminjaman/${loan.id}`}
                    className="block w-full"
                  >
                    {loan.borrowerName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-300">
                  <Link
                    href={`/admin/peminjaman/${loan.id}`}
                    className="block w-full"
                  >
                    {loan.borrowerDivision}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-300">
                  <Link
                    href={`/admin/peminjaman/${loan.id}`}
                    className="block w-full"
                  >
                    {loan.loanItems.length}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_COLOR[loan.status] ?? ""}`}
                  >
                    {loan.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/peminjaman/${loan.id}`}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    Buka →
                  </Link>
                </td>
              </tr>
            ))}
            {loans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  Belum ada request peminjaman.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

