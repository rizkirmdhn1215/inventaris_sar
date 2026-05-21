import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolveAdminScope, getActiveLocations, type AdminScope } from "@/lib/location-scope";

export async function requireAdminPageScope(lokasiSlug?: string | null): Promise<{
  session: NonNullable<Awaited<ReturnType<typeof verifySession>>>;
  scope: AdminScope;
  locations: Awaited<ReturnType<typeof getActiveLocations>>;
}> {
  const session = await verifySession();
  if (!session) redirect("/login");

  const scope = await resolveAdminScope(session, lokasiSlug);
  const locations = await getActiveLocations();

  return { session, scope, locations };
}
