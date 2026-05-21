import Link from "next/link";
import { db } from "@/lib/db";
import { Boxes, ArrowUpRight, Clock, AlertTriangle, Wrench, FileDown } from "lucide-react";
import { formatTanggalID, startOfMonth, endOfMonth, STATUS_COLOR } from "@/lib/format";
import { parseLoanLogFilters, buildRecapQueryString } from "@/lib/loan-filters";
import { groupLoanItemsForPdf } from "@/lib/inventory";

type DashboardPageProps = {
  searchParams: Promise<{
    bulan?: string;
    peminjam?: string;
    barang?: string;
    status?: string;
  }>;
};

export default async function AdminDashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const now = new Date();
  const {
    monthFilter,
    peminjamFilter,
    barangFilter,
    statusFilter,
    where,
  } = parseLoanLogFilters(params);

  const [available, borrowed, maintenance, pending, thisMonthLoans, badCondition, loans] =
    await Promise.all([
      db.itemUnit.count({ where: { status: "available" } }),
      db.itemUnit.count({ where: { status: "borrowed" } }),
      db.itemUnit.count({ where: { status: "maintenance" } }),
      db.loan.count({ where: { status: "pending" } }),
      db.loan.count({
        where: { createdAt: { gte: startOfMonth(now), lt: endOfMonth(now) } },
      }),
      db.itemUnit.count({ where: { condition: { in: ["damaged", "lost"] } } }),
      db.loan.findMany({
        where,
        include: {
          loanItems: {
            include: {
              itemUnit: { include: { item: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const currentMonthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recapHref = `/api/admin/recap/pdf${buildRecapQueryString(params)}`;

  const statCards = [
    {
      label: "Barang tersedia",
      value: available,
      sublabel: "Unit di gudang",
      icon: Boxes,
      href: "/admin/barang?tab=units&status=available",
    },
    {
      label: "Sedang dipinjam",
      value: borrowed,
      sublabel: "Unit aktif",
      icon: ArrowUpRight,
      href: "/admin/barang?tab=units&status=borrowed",
    },
    {
      label: "Maintenance",
      value: maintenance,
      sublabel: "Tidak bisa dipinjam",
      icon: Wrench,
      href: "/admin/barang?tab=units&status=maintenance",
    },
    {
      label: "Request pending",
      value: pending,
      sublabel: "Menunggu approve",
      icon: Clock,
      href: "/admin/peminjaman?status=pending",
    },
    {
      label: "Pinjam bulan ini",
      value: thisMonthLoans,
      sublabel: formatTanggalID(now),
      icon: Clock,
      href: `/admin/dashboard?bulan=${currentMonthParam}`,
    },
    {
      label: "Rusak / hilang",
      value: badCondition,
      sublabel: "Perlu tindak lanjut",
      icon: AlertTriangle,
      href: "/admin/barang?tab=units&status=damaged",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Ringkasan kondisi barang & aktivitas peminjaman.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 flex flex-col gap-2 hover:border-orange-500/40 hover:bg-zinc-900 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400 group-hover:text-zinc-200">{card.label}</p>
                <div className="w-7 h-7 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:bg-orange-500/20">
                  <Icon className="w-4 h-4 text-orange-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-white">{card.value}</p>
                <p className="text-[11px] text-zinc-500">{card.sublabel}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-white">Log Peminjaman</h2>
            <p className="text-xs text-zinc-400">Filter sesuai kebutuhan, lalu unduh rekap PDF.</p>
          </div>
          <a
            href={recapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
          >
            <FileDown className="w-3.5 h-3.5" />
            Unduh Rekap PDF
          </a>
        </div>

        <form className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-b border-zinc-800">
          <input
            type="month"
            name="bulan"
            defaultValue={monthFilter}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            name="peminjam"
            defaultValue={peminjamFilter}
            placeholder="Nama peminjam"
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <input
            name="barang"
            defaultValue={barangFilter}
            placeholder="Nama barang"
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">Semua status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="returned">Returned</option>
          </select>
          <div className="col-span-2 md:col-span-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white"
            >
              Filter
            </button>
            <Link
              href="/admin/dashboard"
              className="rounded-lg border border-zinc-700 hover:border-zinc-600 px-4 py-2 text-sm text-zinc-200"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/80 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Peminjam</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Divisi</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Pinjam</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Barang</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const itemNames = groupLoanItemsForPdf(loan.loanItems)
                  .map((g) => `${g.itemName} (${g.quantity})`)
                  .join(", ");
                const cellLink = (children: React.ReactNode) => (
                  <Link href={`/admin/peminjaman/${loan.id}`} className="block w-full">
                    {children}
                  </Link>
                );
                return (
                  <tr
                    key={loan.id}
                    className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/30 cursor-pointer"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-100">
                      {cellLink(loan.borrowerName)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-300">
                      {cellLink(loan.borrowerDivision)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-300">
                      {cellLink(formatTanggalID(loan.borrowDate))}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{cellLink(itemNames)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/admin/peminjaman/${loan.id}`} className="block">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${STATUS_COLOR[loan.status] ?? ""}`}
                        >
                          {loan.status}
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    Tidak ada data sesuai filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
