import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const DEFAULT_LOCATION_SLUG = "kpp-padang";

export type LocationSummary = {
  id: string;
  slug: string;
  name: string;
  type: string;
};

export type AdminScope = {
  isSuperAdmin: boolean;
  adminLocationId: string | null;
  activeLocationId: string;
  activeLocation: LocationSummary;
  /** Prisma filter for location-scoped tables */
  locationId: string;
};

export async function getActiveLocations() {
  return db.location.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, type: true, description: true },
  });
}

export function locationTypeLabel(type: string) {
  if (type === "kpp") return "KPP";
  if (type === "pos") return "Pos SAR";
  return type.toUpperCase();
}

export async function getLocationBySlug(slug: string) {
  return db.location.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, type: true, description: true },
  });
}

export async function getDefaultLocation() {
  const loc = await getLocationBySlug(DEFAULT_LOCATION_SLUG);
  if (loc) return loc;
  const first = await db.location.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, type: true, description: true },
  });
  if (!first) throw new Error("No active location configured.");
  return first;
}

/** Resolve which location an admin session operates on. */
export async function resolveAdminScope(
  session: { adminId: string; role: string },
  lokasiSlug?: string | null
): Promise<AdminScope> {
  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { role: true, locationId: true },
  });
  if (!admin) throw new Error("Admin not found");

  const isSuperAdmin = admin.role === "superadmin";

  if (!isSuperAdmin) {
    if (!admin.locationId) {
      throw new Error("Admin regional belum ditetapkan ke lokasi.");
    }
    const activeLocation = await db.location.findUnique({
      where: { id: admin.locationId },
      select: { id: true, slug: true, name: true, type: true },
    });
    if (!activeLocation) throw new Error("Lokasi admin tidak ditemukan.");
    return {
      isSuperAdmin: false,
      adminLocationId: admin.locationId,
      activeLocationId: activeLocation.id,
      activeLocation,
      locationId: activeLocation.id,
    };
  }

  if (lokasiSlug) {
    const picked = await getLocationBySlug(lokasiSlug);
    if (picked) {
      return {
        isSuperAdmin: true,
        adminLocationId: null,
        activeLocationId: picked.id,
        activeLocation: picked,
        locationId: picked.id,
      };
    }
  }

  const fallback = await getDefaultLocation();
  return {
    isSuperAdmin: true,
    adminLocationId: null,
    activeLocationId: fallback.id,
    activeLocation: fallback,
    locationId: fallback.id,
  };
}

export function scopeWhere<T extends { locationId?: string }>(
  scope: AdminScope
): { locationId: string } {
  return { locationId: scope.locationId };
}

export function appendLokasiQuery(path: string, slug: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}lokasi=${encodeURIComponent(slug)}`;
}

export type LocationStats = {
  locationId: string;
  slug: string;
  name: string;
  type: string;
  available: number;
  borrowed: number;
  maintenance: number;
  pendingLoans: number;
};

export async function getLocationStatsForIds(
  locationIds: string[]
): Promise<LocationStats[]> {
  if (locationIds.length === 0) return [];

  const locations = await db.location.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, slug: true, name: true, type: true },
  });

  const results: LocationStats[] = [];
  for (const loc of locations) {
    const [available, borrowed, maintenance, pendingLoans] = await Promise.all([
      db.itemUnit.count({
        where: { status: "available", item: { locationId: loc.id } },
      }),
      db.itemUnit.count({
        where: { status: "borrowed", item: { locationId: loc.id } },
      }),
      db.itemUnit.count({
        where: { status: "maintenance", item: { locationId: loc.id } },
      }),
      db.loan.count({ where: { locationId: loc.id, status: "pending" } }),
    ]);
    results.push({
      locationId: loc.id,
      slug: loc.slug,
      name: loc.name,
      type: loc.type,
      available,
      borrowed,
      maintenance,
      pendingLoans,
    });
  }
  return results;
}

export async function getAllLocationStats(): Promise<LocationStats[]> {
  const locations = await db.location.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  return getLocationStatsForIds(locations.map((l) => l.id));
}

export function loanWhereWithScope(
  scope: AdminScope,
  extra?: Prisma.LoanWhereInput
): Prisma.LoanWhereInput {
  return { locationId: scope.locationId, ...extra };
}

export function itemWhereWithScope(
  scope: AdminScope,
  extra?: Prisma.ItemWhereInput
): Prisma.ItemWhereInput {
  return { locationId: scope.locationId, ...extra };
}
