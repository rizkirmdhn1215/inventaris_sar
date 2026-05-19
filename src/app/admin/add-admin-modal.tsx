"use client";

import { useActionState, useEffect } from "react";
import { X, Loader2, UserPlus } from "lucide-react";
import { createAdminAction, type AccountActionState } from "./account-actions";

type AddAdminModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AddAdminModal({ open, onClose }: AddAdminModalProps) {
  const [state, formAction, pending] = useActionState<
    AccountActionState | null,
    FormData
  >(createAdminAction, null);

  useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [state?.success, onClose]);

  if (!open) return null;

  return (
    <>
      {/* wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
          aria-label="Tutup"
        />
        <div
          className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <UserPlus className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white flex-1">Tambah Admin</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form action={formAction} className="p-4 space-y-3">
            {state?.error ? (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {state.error}
              </p>
            ) : null}
            {state?.success ? (
              <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">
                {state.success}
              </p>
            ) : null}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nama lengkap</label>
              <input
                name="name"
                required
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="nama@sarpadang.go.id"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Password awal</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Min. 8 karakter"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Peran</label>
              <select
                name="role"
                defaultValue="admin"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Tambah
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
