"use client";

import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { locationTypeLabel, type PublicLocation } from "@/lib/locations";

export function LocationPicker({
  locations,
  selectedSlug,
}: {
  locations: PublicLocation[];
  selectedSlug?: string | null;
}) {
  if (locations.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        Belum ada lokasi gudang aktif.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {locations.map((loc) => {
        const active = selectedSlug === loc.slug;
        const href = `/?lokasi=${encodeURIComponent(loc.slug)}`;
        return (
          <Link
            key={loc.id}
            href={href}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              active
                ? "border-orange-500/60 bg-orange-500/10"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  loc.type === "kpp" ? "bg-orange-500/20" : "bg-zinc-800"
                }`}
              >
                {loc.type === "kpp" ? (
                  <Building2 className="w-5 h-5 text-orange-400" />
                ) : (
                  <MapPin className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{loc.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {locationTypeLabel(loc.type)}
                </p>
                {loc.description ? (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {loc.description}
                  </p>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
