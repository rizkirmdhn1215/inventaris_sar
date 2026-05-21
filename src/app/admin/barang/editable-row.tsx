"use client";

import { useState, useTransition } from "react";
import { Trash2, Save, X } from "lucide-react";
import { upsertItemAction, deleteItemAction } from "./actions";
import { UnitCountControl, MaintenanceControl } from "./unit-controls";

type Category = { id: string; name: string };

export type EditableItem = {
  id: string;
  name: string;
  description: string | null;
  merk: string | null;
  type: string | null;
  kodeGudang: string | null;
  categoryId: string | null;
  category: { name: string } | null;
  unitCount: number;
  availableCount: number;
  borrowedCount: number;
  maintenanceCount: number;
};

export function EditableItemRow({
  item,
  categories,
}: {
  item: EditableItem;
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(item);

  const onSave = () => {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("name", draft.name ?? "");
    fd.set("description", draft.description ?? "");
    fd.set("categoryId", draft.categoryId ?? "");
    fd.set("merk", draft.merk ?? "");
    fd.set("type", draft.type ?? "");
    fd.set("kodeGudang", draft.kodeGudang ?? "");
    startTransition(async () => {
      await upsertItemAction(fd);
      setEditing(false);
    });
  };

  const onDelete = () => {
    if (!confirm(`Hapus ${item.name}?`)) return;
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(async () => {
      await deleteItemAction(fd);
    });
  };

  if (!editing) {
    return (
      <tr
        className="border-b border-zinc-800/80 last:border-0 hover:bg-zinc-900/40 cursor-pointer"
        onDoubleClick={() => setEditing(true)}
        title="Klik dua kali untuk edit metadata"
      >
        <td className="px-4 py-2 text-zinc-100">{item.name}</td>
        <td className="px-4 py-2 text-zinc-300">{item.category?.name ?? "-"}</td>
        <td className="px-4 py-2 text-zinc-300">{item.merk ?? "-"}</td>
        <td className="px-4 py-2 text-zinc-300">{item.type ?? "-"}</td>
        <td className="px-4 py-2 text-zinc-300 font-mono text-xs">{item.kodeGudang ?? "-"}</td>
        <td className="px-4 py-2 text-zinc-400 max-w-xs truncate">{item.description ?? "-"}</td>
        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
          <UnitCountControl itemId={item.id} totalCount={item.unitCount} />
        </td>
        <td className="px-4 py-2 text-emerald-300 text-xs">{item.availableCount}</td>
        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
          <MaintenanceControl
            itemId={item.id}
            maintenanceCount={item.maintenanceCount}
            availableCount={item.availableCount}
          />
        </td>
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        </td>
      </tr>
    );
  }

  const inputCls =
    "w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs text-white";

  return (
    <tr className="border-b border-zinc-800/80 last:border-0 bg-zinc-900/60">
      <td className="px-2 py-2">
        <input
          className={inputCls}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <select
          className={inputCls}
          value={draft.categoryId ?? ""}
          onChange={(e) =>
            setDraft({ ...draft, categoryId: e.target.value || null })
          }
        >
          <option value="">-</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          value={draft.merk ?? ""}
          onChange={(e) => setDraft({ ...draft, merk: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          value={draft.type ?? ""}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          value={draft.kodeGudang ?? ""}
          onChange={(e) => setDraft({ ...draft, kodeGudang: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <input
          className={inputCls}
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </td>
      <td className="px-2 py-2 text-zinc-400 text-xs">{item.unitCount}</td>
      <td className="px-2 py-2 text-zinc-400 text-xs">{item.availableCount}</td>
      <td className="px-2 py-2 text-zinc-400 text-xs">{item.maintenanceCount}</td>
      <td className="px-2 py-2 whitespace-nowrap">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50 mr-2"
        >
          <Save className="w-3.5 h-3.5" /> Simpan
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(item);
            setEditing(false);
          }}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <X className="w-3.5 h-3.5" /> Batal
        </button>
      </td>
    </tr>
  );
}
