"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { updateProfileAction, type AccountActionState } from "./account-actions";
import { AccountAvatar } from "./account-avatar";
import { updateSavedAccountProfile } from "@/lib/auth/saved-accounts";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";

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
  const [pickedFile, setPickedFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPreview(imageUrl);
      setRemoveImage(false);
      setPickedFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, imageUrl]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!state?.success) return;

    const newName = state.name ?? name;
    const newImage = state.imageUrl ?? null;
    const newNip = state.nip !== undefined ? state.nip : initialNip;

    updateSavedAccountProfile(adminId, { name: newName, imageUrl: newImage });
    onUpdated({ name: newName, imageUrl: newImage, nip: newNip });
    onClose();
  }, [state?.success, state?.name, state?.imageUrl, state?.nip, adminId, name, initialNip, onUpdated, onClose]);

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert("Ukuran foto maksimal 5 MB.");
      return;
    }
    setRemoveImage(false);
    setPickedFile(true);
    setPreview(URL.createObjectURL(file));
  }

  const hasPhoto = Boolean(preview && !removeImage);

  return (
    <Modal open={open} onClose={onClose} title="Edit Akun">
      <form
        action={formAction}
        encType="multipart/form-data"
        className="p-4 space-y-4"
      >
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

        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-xs font-medium text-zinc-300">Foto profil</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
            title={hasPhoto ? "Ganti foto profil" : "Tambah foto profil"}
          >
            <AccountAvatar name={name} imageUrl={hasPhoto ? preview : null} size="lg" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>
          <p className="text-[10px] text-zinc-500 text-center">
            Klik foto untuk unggah. Maks. 5 MB (JPG, PNG, WebP).
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-orange-500/50 text-zinc-200"
            >
              {hasPhoto ? "Ganti foto" : "Tambah foto"}
            </button>
            {hasPhoto ? (
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setPickedFile(false);
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          <input type="hidden" name="removeImage" value={String(removeImage)} />
          {pickedFile && !removeImage ? (
            <p className="text-[10px] text-orange-300">Foto baru siap disimpan — klik Simpan.</p>
          ) : null}
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
            <PasswordInput
              name="currentPassword"
              autoComplete="current-password"
              inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password baru</label>
            <PasswordInput
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              placeholder="Min. 8 karakter"
              inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Konfirmasi password baru
            </label>
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
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
