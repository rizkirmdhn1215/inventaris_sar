export {
  getActiveLocations,
  getLocationBySlug,
  getDefaultLocation,
  locationTypeLabel,
} from "@/lib/location-scope";

export type PublicLocation = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
};
