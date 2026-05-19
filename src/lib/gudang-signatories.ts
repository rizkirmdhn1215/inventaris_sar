/** Default Pengawas Gudang on loan letters (override via env). */
export const DEFAULT_PENGAWAS_GUDANG = {
  name: process.env.DEFAULT_PENGAWAS_GUDANG_NAME?.trim() || "ALVIZAN Z., S.H.",
  nip: process.env.DEFAULT_PENGAWAS_GUDANG_NIP?.trim() || "",
};
