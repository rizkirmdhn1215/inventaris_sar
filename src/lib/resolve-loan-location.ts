import { db } from "@/lib/db";
import { getLocationBySlug } from "@/lib/location-scope";

/** Resolve location for a public loan submit (hidden field may be missing). */
export async function resolveLoanLocationFromForm(formData: FormData) {
  const rawId = String(formData.get("locationId") ?? "").trim();
  if (rawId) {
    const loc = await db.location.findFirst({
      where: { id: rawId, isActive: true },
      select: { id: true, slug: true },
    });
    if (loc) return loc;
  }

  const slug = String(formData.get("lokasi") ?? "").trim();
  if (slug) {
    const loc = await getLocationBySlug(slug);
    if (loc) return { id: loc.id, slug: loc.slug };
  }

  const firstItemId = String(formData.getAll("borrowItemId")[0] ?? "").trim();
  if (firstItemId) {
    const item = await db.item.findFirst({
      where: { id: firstItemId },
      select: {
        location: { select: { id: true, slug: true, isActive: true } },
      },
    });
    if (item?.location?.isActive) {
      return { id: item.location.id, slug: item.location.slug };
    }
  }

  return null;
}
