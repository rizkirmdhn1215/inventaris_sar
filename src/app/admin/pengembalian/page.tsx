import Link from "next/link";
import { db } from "@/lib/db";

type PengembalianPageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function PengembalianPage({
  searchParams,
}: PengembalianPageProps) {
  const params = await searchParams;
  const loans = await db.loan.findMany({
    where: {
      status: {
        in: ["approved", "returned"],
      },
    },
    include: { loanItems: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Pengembalian</h1>
        <p className="text-sm text-zinc-400">
          Proses cek kondisi dan tutup sesi peminjaman.
        </p>
      </div>

      {params.success ? (
        <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
          Pengembalian berhasil disimpan.
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-zinc-400">Peminjam</th>
              <th className="px-4 py-2 text-left text-zinc-400">Status</th>
              <th className="px-4 py-2 text-left text-zinc-400">Total Unit</th>
              <th className="px-4 py-2 text-left text-zinc-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-b border-zinc-800/70 last:border-0">
                <td className="px-4 py-2 text-zinc-100">{loan.borrowerName}</td>
                <td className="px-4 py-2 text-zinc-300">{loan.status}</td>
                <td className="px-4 py-2 text-zinc-300">{loan.loanItems.length}</td>
                <td className="px-4 py-2">
                  {loan.status === "approved" ? (
                    <Link
                      href={`/admin/pengembalian/${loan.id}`}
                      className="text-orange-400 hover:text-orange-300"
                    >
                      Proses Return
                    </Link>
                  ) : (
                    <span className="text-zinc-500">Selesai</span>
                  )}
                </td>
              </tr>
            ))}
            {loans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                  Belum ada data pengembalian.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

