const ID_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggalID(date: Date | string | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  returned: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  good: "bg-emerald-500/10 text-emerald-400",
  damaged: "bg-amber-500/10 text-amber-400",
  lost: "bg-red-500/10 text-red-400",
  available: "bg-emerald-500/10 text-emerald-400",
  borrowed: "bg-orange-500/10 text-orange-400",
  maintenance: "bg-violet-500/10 text-violet-400",
  retired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};
