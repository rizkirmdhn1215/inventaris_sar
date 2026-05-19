import { PPP_PEMULA_SEED } from "./internal-borrowers-pemula";
import { STAFF_ROSTER_SEED } from "./staff-roster";

export type { InternalBorrowerSeed } from "./internal-borrower-types";
import type { InternalBorrowerSeed } from "./internal-borrower-types";

function mergeByNip(...lists: InternalBorrowerSeed[][]): InternalBorrowerSeed[] {
  const map = new Map<string, InternalBorrowerSeed>();
  for (const list of lists) {
    for (const row of list) {
      map.set(row.nip, row);
    }
  }
  return [...map.values()];
}

/** Roster utama diutamakan; entri pemula hanya menambah NIP yang belum ada */
export const INTERNAL_BORROWERS_SEED = mergeByNip(
  STAFF_ROSTER_SEED,
  PPP_PEMULA_SEED
);
