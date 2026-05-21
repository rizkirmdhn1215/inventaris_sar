"use client";

import { useActionState } from "react";
import {
  createLocationAction,
  createRegionalAdminAction,
  type LokasiActionState,
} from "./actions";
import { PasswordInput } from "@/components/password-input";

export function CreateLocationForm() {
  const [state, action, pending] = useActionState<LokasiActionState | null, FormData>(
    createLocationAction,
    null
  );

  return (
    <form
      action={action}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
    >
      <h3 className="text-sm font-medium text-white">Tambah Lokasi Baru</h3>
      {state?.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      {state?.success ? <p className="text-xs text-emerald-400">{state.success}</p> : null}
      <input
        name="name"
        required
        placeholder="Nama (mis: Pos SAR Bukittinggi)"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      />
      <input
        name="slug"
        placeholder="Slug URL (opsional, auto dari nama)"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white font-mono"
      />
      <select
        name="type"
        defaultValue="pos"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      >
        <option value="kpp">KPP</option>
        <option value="pos">Pos SAR</option>
      </select>
      <input
        name="description"
        placeholder="Deskripsi singkat"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 py-2 text-sm text-white disabled:opacity-50"
      >
        Buat Lokasi
      </button>
    </form>
  );
}

export function CreateRegionalAdminForm({
  locations,
}: {
  locations: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<LokasiActionState | null, FormData>(
    createRegionalAdminAction,
    null
  );

  return (
    <form
      action={action}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3"
    >
      <h3 className="text-sm font-medium text-white">Admin untuk Lokasi</h3>
      <p className="text-xs text-zinc-500">
        Admin ini hanya mengelola inventaris & peminjaman di lokasi yang dipilih.
      </p>
      {state?.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      {state?.success ? <p className="text-xs text-emerald-400">{state.success}</p> : null}
      <select
        name="locationId"
        required
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      >
        <option value="">Pilih lokasi</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <input
        name="name"
        required
        placeholder="Nama admin"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Email login"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white"
      />
      <PasswordInput
        name="password"
        required
        minLength={8}
        placeholder="Password awal"
        inputClassName="w-full rounded-lg bg-zinc-950 border border-zinc-800 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={pending || locations.length === 0}
        className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 py-2 text-sm text-white disabled:opacity-50"
      >
        Tambah Admin Regional
      </button>
    </form>
  );
}
