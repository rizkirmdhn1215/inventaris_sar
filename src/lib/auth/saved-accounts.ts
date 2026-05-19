export type SavedAccount = {
  adminId: string;
  email: string;
  name: string;
  imageUrl: string | null;
  role: string;
  switchToken: string;
};

const STORAGE_KEY = 'sar_saved_accounts';

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertSavedAccount(account: SavedAccount) {
  const list = getSavedAccounts().filter((a) => a.adminId !== account.adminId);
  list.unshift(account);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 8)));
}

export function removeSavedAccount(adminId: string) {
  const list = getSavedAccounts().filter((a) => a.adminId !== adminId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearSavedAccounts() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function updateSavedAccountProfile(
  adminId: string,
  patch: Partial<Pick<SavedAccount, 'name' | 'imageUrl' | 'email' | 'role'>>
) {
  const list = getSavedAccounts().map((a) =>
    a.adminId === adminId ? { ...a, ...patch } : a
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
