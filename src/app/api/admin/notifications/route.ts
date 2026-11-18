import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, role: true, locationId: true },
  });

  if (!admin) {
    return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });
  }

  const url = new URL(req.url);
  const lokasiSlug = url.searchParams.get("lokasi");

  let targetLocationId = admin.locationId;
  if (admin.role === "superadmin" && lokasiSlug) {
    const loc = await db.location.findUnique({ where: { slug: lokasiSlug } });
    if (loc) targetLocationId = loc.id;
  }

  const locFilter = targetLocationId ? { locationId: targetLocationId } : {};

  try {
    // 1. Peminjaman baru HANYA yang status === "pending" (yang approved tidak dimunculkan)
    const pendingLoans = await db.loan.findMany({
      where: {
        ...locFilter,
        status: "pending",
      },
      include: {
        loanItems: {
          include: {
            itemUnit: {
              select: { item: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 2. Pengembalian barang: HANYA sesi pinjam aktif berstatus "approved" yang menunggu diproses return (yang sudah selesai dikembalikan tidak dimunculkan)
    const activeReturnLoans = await db.loan.findMany({
      where: {
        ...locFilter,
        status: "approved",
      },
      include: {
        loanItems: {
          include: {
            itemUnit: {
              select: { item: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    type NotificationItem = {
      id: string;
      type: "loan_new" | "loan_return";
      title: string;
      message: string;
      subMessage?: string;
      url: string;
      timestamp: string;
      badgeText: string;
      badgeColor: "orange" | "emerald";
    };

    const notifs: NotificationItem[] = [];

    // Format notifikasi peminjaman baru (HANYA pending)
    for (const loan of pendingLoans) {
      const totalUnits = loan.loanItems.length;
      const sampleItem = loan.loanItems[0]?.itemUnit?.item?.name ?? "Barang";
      const itemDesc = totalUnits > 1 ? `${sampleItem} (+${totalUnits - 1} lainnya)` : sampleItem;

      notifs.push({
        id: `loan-${loan.id}`,
        type: "loan_new",
        title: "Permohonan Peminjaman Baru",
        message: `${loan.borrowerName} (${loan.borrowerDivision})`,
        subMessage: `${totalUnits} unit · ${itemDesc}`,
        url: `/admin/peminjaman/${loan.id}`,
        timestamp: loan.createdAt.toISOString(),
        badgeText: "Menunggu Persetujuan",
        badgeColor: "orange",
      });
    }

    // Format notifikasi pengembalian barang (HANYA yang aktif menunggu diproses return)
    for (const loan of activeReturnLoans) {
      const totalUnits = loan.loanItems.length;
      const sampleItem = loan.loanItems[0]?.itemUnit?.item?.name ?? "Barang";
      const itemDesc = totalUnits > 1 ? `${sampleItem} (+${totalUnits - 1} lainnya)` : sampleItem;
      const returnTime = loan.approvedAt ?? loan.createdAt;

      notifs.push({
        id: `return-${loan.id}`,
        type: "loan_return",
        title: "Menunggu Pengembalian Barang",
        message: `${loan.borrowerName} (${loan.borrowerDivision})`,
        subMessage: `${totalUnits} unit · ${itemDesc} · Siap diproses return`,
        url: `/admin/pengembalian/${loan.id}`,
        timestamp: returnTime.toISOString(),
        badgeText: "Proses Return",
        badgeColor: "emerald",
      });
    }

    // Urutkan berdasarkan timestamp desc
    notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const [pendingCount, approvedCount] = await Promise.all([
      db.loan.count({ where: { ...locFilter, status: "pending" } }),
      db.loan.count({ where: { ...locFilter, status: "approved" } }),
    ]);

    return NextResponse.json({
      notifications: notifs.slice(0, 20),
      counts: {
        pendingLoans: pendingCount,
        activeReturns: approvedCount,
      },
    });
  } catch (err) {
    console.error("Notifications API error:", err);
    return NextResponse.json({ error: "Gagal memuat notifikasi" }, { status: 500 });
  }
}
