"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { updateProfileAction, type AccountActionState } from "./account-actions";
import { AccountAvatar } from "./account-avatar";
import { updateSavedAccountProfile } from "@/lib/auth/saved-accounts";
import { Modal } from "@/components/modal";

type EditAccountModalProps = {
  open: boolean;
  onClose: () => void;
  adminId: string;
  name: string;
  email: string;
  imageUrl: string | null;
  nip: string | null;
  onUpdated: (patch: { name: string; imageUrl: string | null; nip: string | null }) => void;
};

export function EditAccountModal({
  open,
  onClose,
  adminId,
  name,
  email,
  imageUrl,
  nip: initialNip,
  onUpdated,
}: EditAccountModalProps) {
  const [state, formAction, pending] = useActionState<
    AccountActionState | null,
    FormData
  >(updateProfileAction, null);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPreview(imageUrl);
      setRemoveImage(false);
    }
  }, [open, imageUrl]);

  useEffect(() => {
    if (state?.success) {
      const newName =
        (document.getElementById("edit-account-name") as HTMLInputElement)
          ?.value ?? name;
      const newImage = removeImage ? null : preview;
      updateSavedAccountProfile(adminId, { name: newName, imageUrl: newImage });
      const newNip =
        (document.getElementById("edit-account-nip") as HTMLInputElement)?.value?.trim() ||
        null;
      onUpdated({ name: newName, imageUrl: newImage, nip: newNip });
      onClose();
    }
  }, [state?.success, adminId, name, preview, removeImage, onUpdated, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Edit Akun">
      <form action={formAction} className="p-4 space-y-4">
        {state?.error ? (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <AccountAvatar name={name} imageUrl={preview} size="lg" />
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-orange-500/50"
            >
              Ganti foto
            </button>
            {(preview || imageUrl) && !removeImage ? (
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setPreview(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-red-400 hover:border-red-500/50 inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Hapus foto
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRemoveImage(false);
              setPreview(URL.createObjectURL(file));
            }}
          />
          <input type="hidden" name="removeImage" value={String(removeImage)} />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Nama</label>
          <input
            id="edit-account-name"
            name="name"
            defaultValue={name}
            required
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">NIP</label>
          <input
            id="edit-account-nip"
            name="nip"
            defaultValue={initialNip ?? ""}
            placeholder="NIP Petugas Gudang"
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
          />
          <p className="text-[10px] text-zinc-500 mt-1">
            Ditampilkan di surat peminjaman sebagai Petugas Gudang.
          </p>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Email</label>
          <input
            value={email}
            disabled
            className="w-full rounded-lg bg-zinc-950/50 border border-zinc-800 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
          />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
          <p className="text-xs font-medium text-zinc-300">Ganti password</p>
          <p className="text-[10px] text-zinc-500">
            Kosongkan jika tidak ingin mengubah password.
          </p>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password saat ini</label>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password baru</label>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Min. 8 karakter"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Konfirmasi password baru
            </label>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
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
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}
