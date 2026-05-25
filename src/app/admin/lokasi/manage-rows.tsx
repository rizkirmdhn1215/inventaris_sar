"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { PasswordInput } from "@/components/password-input";
import {
  updateLocationAction,
  deleteLocationAction,
  updateRegionalAdminAction,
  deleteRegionalAdminAction,
} from "./actions";
import { PROTECTED_LOCATION_ID, type LokasiActionState } from "./constants";

export type LocationRowData = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
};

export function LocationRowActions({ location }: { location: LocationRowData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editState, editAction, editPending] = useActionState<
    LokasiActionState | null,
    FormData
  >(updateLocationAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    LokasiActionState | null,
    FormData
  >(deleteLocationAction, null);

  const isProtected = location.id === PROTECTED_LOCATION_ID;

  useEffect(() => {
    if (editState?.success) {
      setEditOpen(false);
      router.refresh();
    }
  }, [editState?.success, router]);

  useEffect(() => {
    if (deleteState?.success) router.refresh();
  }, [deleteState?.success, router]);

  function onDelete() {
    if (isProtected) return;
    const ok = window.confirm(
      `Hapus lokasi "${location.name}"?\n\nHanya bisa dihapus jika tidak ada barang dan riwayat pinjam.`
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", location.id);
    deleteAction(fd);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        {!isProtected ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {deletePending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Hapus
          </button>
        ) : null}
      </div>
      {deleteState?.error ? (
        <p className="text-[10px] text-red-400 mt-1 max-w-[200px]">{deleteState.error}</p>
      ) : null}
      {deleteState?.success ? (
        <p className="text-[10px] text-emerald-400 mt-1">{deleteState.success}</p>
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Lokasi">
        <form action={editAction} className="p-4 space-y-3">
          <input type="hidden" name="id" value={location.id} />
          {editState?.error ? (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {editState.error}
            </p>
          ) : null}
          {editState?.success ? (
            <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">
              {editState.success}
            </p>
          ) : null}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nama</label>
            <input
              name="name"
              required
              defaultValue={location.name}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Slug URL</label>
            <input
              name="slug"
              defaultValue={location.slug}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Tipe</label>
            <select
              name="type"
              defaultValue={location.type}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            >
              <option value="kpp">KPP</option>
              <option value="pos">Pos SAR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Deskripsi</label>
            <input
              name="description"
              defaultValue={location.description ?? ""}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={location.isActive}
              className="rounded border-zinc-600"
            />
            Lokasi aktif (tampil di beranda & pinjam)
          </label>
          <p className="text-[10px] text-zinc-500">
            Uncheck untuk menonaktifkan lokasi tanpa menghapus data inventaris.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 py-2 text-sm text-white disabled:opacity-50"
            >
              {editPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export type AdminRowData = {
  id: string;
  name: string;
  email: string;
  nip: string | null;
  locationId: string | null;
};

export function AdminRowActions({
  admin,
  locations,
}: {
  admin: AdminRowData;
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editState, editAction, editPending] = useActionState<
    LokasiActionState | null,
    FormData
  >(updateRegionalAdminAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    LokasiActionState | null,
    FormData
  >(deleteRegionalAdminAction, null);

  useEffect(() => {
    if (editState?.success) {
      setEditOpen(false);
      router.refresh();
    }
  }, [editState?.success, router]);

  useEffect(() => {
    if (deleteState?.success) router.refresh();
  }, [deleteState?.success, router]);

  function onDelete() {
    const ok = window.confirm(`Hapus akun admin "${admin.name}" (${admin.email})?`);
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", admin.id);
    deleteAction(fd);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {deletePending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Hapus
        </button>
      </div>
      {deleteState?.error ? (
        <p className="text-[10px] text-red-400 mt-1 max-w-[220px]">{deleteState.error}</p>
      ) : null}
      {deleteState?.success ? (
        <p className="text-[10px] text-emerald-400 mt-1">{deleteState.success}</p>
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Admin Regional">
        <form action={editAction} className="p-4 space-y-3">
          <input type="hidden" name="id" value={admin.id} />
          {editState?.error ? (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {editState.error}
            </p>
          ) : null}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Lokasi</label>
            <select
              name="locationId"
              required
              defaultValue={admin.locationId ?? ""}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nama</label>
            <input
              name="name"
              required
              defaultValue={admin.name}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Email login</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={admin.email}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">NIP (opsional)</label>
            <input
              name="nip"
              defaultValue={admin.nip ?? ""}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password baru</label>
            <PasswordInput
              name="newPassword"
              minLength={8}
              placeholder="Kosongkan jika tidak diubah"
              inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 py-2 text-sm text-white disabled:opacity-50"
            >
              {editPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
