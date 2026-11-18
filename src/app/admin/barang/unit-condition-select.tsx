"use client";

import { useState, useTransition } from "react";
import { updateUnitConditionAction } from "./actions";
import { Loader2 } from "lucide-react";

const CONDITION_COLORS: Record<string, string> = {
  good: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60",
  maintenance: "bg-violet-950/60 text-violet-300 border-violet-800/60",
  damaged: "bg-amber-950/60 text-amber-400 border-amber-800/60",
  lost: "bg-red-950/60 text-red-400 border-red-800/60",
};

export function UnitConditionSelect({
  unitId,
  initialCondition,
}: {
  unitId: string;
  initialCondition: string;
}) {
  const [value, setValue] = useState(initialCondition);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const prev = value;
    const nextCondition = e.target.value;
    setValue(nextCondition);
    const fd = new FormData();
    fd.set("unitId", unitId);
    fd.set("condition", nextCondition);

    startTransition(async () => {
      const res = await updateUnitConditionAction(fd);
      if (res?.error) {
        setValue(prev);
        alert(res.error);
      }
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={handleChange}
        disabled={isPending}
        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 ${
          CONDITION_COLORS[value] ?? "bg-zinc-800 text-zinc-200 border-zinc-700"
        }`}
      >
        <option value="good" className="bg-zinc-900 text-emerald-400">
          good (Baik)
        </option>
        <option value="maintenance" className="bg-zinc-900 text-violet-300">
          maintenance (Perawatan)
        </option>
        <option value="damaged" className="bg-zinc-900 text-amber-400">
          damaged (Rusak)
        </option>
        <option value="lost" className="bg-zinc-900 text-red-400">
          lost (Hilang)
        </option>
      </select>
      <div className="pointer-events-none absolute right-2 text-zinc-400">
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <span className="text-[9px]">▼</span>
        )}
      </div>
    </div>
  );
}
