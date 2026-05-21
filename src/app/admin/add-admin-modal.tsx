"use client";

import { useActionState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { createAdminAction, type AccountActionState } from "./account-actions";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";

type AddAdminModalProps = {
  open: boolean;
  onClose: () => void;
  locations?: { id: string; name: string }[];
};

export function AddAdminModal({ open, onClose, locations = [] }: AddAdminModalProps) {
  const [state, formAction, pending] = useActionState<
    AccountActionState | null,
    FormData
  >(createAdminAction, null);

  useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [state?.success, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Admin"
      titleIcon={<UserPlus className="w-4 h-4 text-orange-400" />}
    >
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
          <PasswordInput
            name="password"
            required
            minLength={8}
            placeholder="Min. 8 karakter"
            inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Peran</label>
          <select
            name="role"
            defaultValue="admin"
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="admin">Admin Regional (1 lokasi)</option>
            <option value="superadmin">Super Admin (semua lokasi)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Lokasi (wajib untuk Admin Regional)</label>
          <select
            name="locationId"
            defaultValue=""
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">— Pilih lokasi —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
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
    </Modal>
  );
}
