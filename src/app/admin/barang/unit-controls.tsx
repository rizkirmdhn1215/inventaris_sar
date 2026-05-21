"use client";

import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";
import {
  adjustMaintenanceAction,
  adjustUnitCountAction,
} from "./actions";

export function UnitCountControl({
  itemId,
  totalCount,
}: {
  itemId: string;
  totalCount: number;
}) {
  const [value, setValue] = useState(String(totalCount));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setMessage("Masukkan angka valid.");
      return;
    }
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("targetCount", String(n));
    startTransition(async () => {
      const res = await adjustUnitCountAction(fd);
      setMessage(res.error ?? res.success ?? null);
      if (!res.error) setValue(String(n));
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={500}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="w-16 rounded bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs text-white"
          title="Total unit fisik"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="text-[10px] text-orange-400 hover:text-orange-300 disabled:opacity-50"
        >
          Set
        </button>
      </div>
      {message ? (
        <span className={`text-[10px] ${message.includes("diperbarui") ? "text-emerald-400" : "text-red-400"}`}>
          {message}
        </span>
      ) : null}
    </div>
  );
}

export function MaintenanceControl({
  itemId,
  maintenanceCount,
  availableCount,
}: {
  itemId: string;
  maintenanceCount: number;
  availableCount: number;
}) {
  const [value, setValue] = useState(String(maintenanceCount));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setMessage("Masukkan angka valid.");
      return;
    }
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("targetMaintenance", String(n));
    startTransition(async () => {
      const res = await adjustMaintenanceAction(fd);
      setMessage(res.error ?? res.success ?? null);
      if (!res.error) setValue(String(n));
    });
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1" title={`Tersedia untuk pinjam: ${availableCount}`}>
        <Wrench className="w-3 h-3 text-violet-400 shrink-0" />
        <input
          type="number"
          min={0}
          max={500}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="w-14 rounded bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs text-white"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-50"
        >
          Set
        </button>
      </div>
      {message ? (
        <span className={`text-[10px] ${message.includes("diperbarui") ? "text-emerald-400" : "text-red-400"}`}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
