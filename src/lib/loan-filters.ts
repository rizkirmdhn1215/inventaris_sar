import type { Prisma } from "@prisma/client";

export type LoanLogFilters = {
  bulan?: string;
  peminjam?: string;
  barang?: string;
  status?: string;
  lokasi?: string;
};

export function parseLoanLogFilters(
  params: LoanLogFilters,
  locationId?: string
) {
  const now = new Date();
  const monthFilter =
    params.bulan ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yStr, mStr] = monthFilter.split("-");
  const filterStart = new Date(Number(yStr), Number(mStr) - 1, 1);
  const filterEnd = new Date(Number(yStr), Number(mStr), 1);

  const peminjamFilter = (params.peminjam ?? "").trim();
  const barangFilter = (params.barang ?? "").trim();
  const statusFilter =
    params.status && ["pending", "approved", "returned"].includes(params.status)
      ? params.status
      : null;

  const where: Prisma.LoanWhereInput = {
    ...(locationId ? { locationId } : {}),
    createdAt: { gte: filterStart, lt: filterEnd },
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(peminjamFilter
      ? { borrowerName: { contains: peminjamFilter, mode: "insensitive" } }
      : {}),
    ...(barangFilter
      ? {
          loanItems: {
            some: {
              itemUnit: {
                item: { name: { contains: barangFilter, mode: "insensitive" } },
              },
            },
          },
        }
      : {}),
  };

  return {
    monthFilter,
    filterStart,
    filterEnd,
    peminjamFilter,
    barangFilter,
    statusFilter,
    where,
  };
}

export function buildRecapQueryString(filters: LoanLogFilters) {
  const q = new URLSearchParams();
  if (filters.lokasi) q.set("lokasi", filters.lokasi);
  if (filters.bulan) q.set("bulan", filters.bulan);
  if (filters.peminjam) q.set("peminjam", filters.peminjam);
  if (filters.barang) q.set("barang", filters.barang);
  if (filters.status) q.set("status", filters.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}
