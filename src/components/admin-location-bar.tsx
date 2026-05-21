"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MapPin, LayoutGrid } from "lucide-react";
import { locationTypeLabel } from "@/lib/locations";
import { appendLokasiQuery } from "@/lib/location-scope";

type Loc = { slug: string; name: string; type: string };

export function AdminLocationBar({
  isSuperAdmin,
  activeLocation,
  locations,
  fixedForRegional,
}: {
  isSuperAdmin: boolean;
  activeLocation: Loc;
  locations: Loc[];
  fixedForRegional?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lokasiParam = searchParams.get("lokasi");
  const effectiveSlug =
    isSuperAdmin && lokasiParam ? lokasiParam : activeLocation.slug;
  const effectiveName =
    locations.find((l) => l.slug === effectiveSlug)?.name ?? activeLocation.name;
  const currentQs = searchParams.toString();
  const basePath = currentQs
    ? `${pathname}?${currentQs.replace(/(^|&)lokasi=[^&]*&?/g, "$1").replace(/&$/, "")}`
    : pathname;

  function hrefForSlug(slug: string) {
    const clean = basePath.replace(/\?lokasi=[^&]*&?/, "?").replace(/\?$/, "");
    return appendLokasiQuery(clean || pathname, slug);
  }

  if (fixedForRegional) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm">
        <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="text-zinc-300">
          <span className="text-zinc-500">Lokasi: </span>
          {effectiveName}
          <span className="text-zinc-500 ml-1">
            ({locationTypeLabel(activeLocation.type)})
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <LayoutGrid className="w-3.5 h-3.5" />
          Pantau lokasi:
        </span>
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            href={hrefForSlug(loc.slug)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              effectiveSlug === loc.slug
                ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {loc.name}
          </Link>
        ))}
        <Link
          href="/admin/lokasi"
          className="text-xs text-orange-400 hover:text-orange-300 ml-auto"
        >
          Kelola lokasi →
        </Link>
      </div>
    </div>
  );
}
