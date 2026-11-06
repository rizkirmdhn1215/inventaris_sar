"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  ClipboardList,
  Undo2,
  Check,
  ExternalLink,
} from "lucide-react";
import { formatTanggalID } from "@/lib/format";

export type AdminNotification = {
  id: string;
  type: "loan_new" | "loan_return";
  title: string;
  message: string;
  subMessage?: string;
  url: string;
  timestamp: string;
  badgeText: string;
  badgeColor: "orange" | "emerald";
};

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Baru saja";
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatTanggalID(isoString);
}

export function AdminNotifications({
  lokasiSlug,
  onCountsUpdate,
}: {
  lokasiSlug?: string;
  onCountsUpdate?: (counts: { pendingLoans: number; activeReturns: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("sar_admin_read_notifs");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filterType, setFilterType] = useState<"all" | "loan_new" | "loan_return">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const qs = lokasiSlug ? `?lokasi=${encodeURIComponent(lokasiSlug)}` : "";
      const res = await fetch(`/api/admin/notifications${qs}`);
      if (res.ok) {
        const data = await res.json();
        if (data.notifications) {
          setNotifications(data.notifications);
        }
        if (data.counts && onCountsUpdate) {
          onCountsUpdate(data.counts);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    }
  }, [lokasiSlug, onCountsUpdate]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  function markAllAsRead() {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem("sar_admin_read_notifs", JSON.stringify(Array.from(allIds)));
    } catch {
      // ignore
    }
  }

  function markAsRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("sar_admin_read_notifs", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const displayedList = notifications.filter((n) => {
    if (filterType === "all") return true;
    return n.type === filterType;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) loadNotifications();
        }}
        className="relative inline-flex items-center justify-center p-2 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white transition-colors"
        title="Pusat Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-white">Notifikasi Inventaris</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-400 border border-red-900/60">
                  {unreadCount} Baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-zinc-400 hover:text-orange-400 flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Tandai dibaca
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-900/20 px-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 border-b-2 font-medium transition-colors ${
                filterType === "all"
                  ? "border-orange-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("loan_new")}
              className={`px-3 py-1.5 border-b-2 font-medium transition-colors ${
                filterType === "loan_new"
                  ? "border-orange-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pinjam Baru ({notifications.filter((n) => n.type === "loan_new").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("loan_return")}
              className={`px-3 py-1.5 border-b-2 font-medium transition-colors ${
                filterType === "loan_return"
                  ? "border-orange-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Pengembalian ({notifications.filter((n) => n.type === "loan_return").length})
            </button>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto divide-y divide-zinc-900 flex-1">
            {displayedList.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500">
                Tidak ada notifikasi saat ini.
              </div>
            ) : (
              displayedList.map((item) => {
                const isRead = readIds.has(item.id);
                const isLoan = item.type === "loan_new";

                return (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => {
                      markAsRead(item.id);
                      setOpen(false);
                    }}
                    className={`block p-3.5 transition-colors hover:bg-zinc-900/70 ${
                      !isRead ? "bg-zinc-900/40" : "opacity-85"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          isLoan
                            ? "bg-orange-950/60 text-orange-400 border border-orange-900/60"
                            : "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60"
                        }`}
                      >
                        {isLoan ? (
                          <ClipboardList className="w-4 h-4" />
                        ) : (
                          <Undo2 className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-semibold text-white truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            {formatTimeAgo(item.timestamp)}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {item.message}
                        </p>

                        {item.subMessage && (
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {item.subMessage}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/40">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.badgeColor === "orange"
                                ? "bg-orange-950/80 text-orange-400 border border-orange-900/50"
                                : "bg-emerald-950/80 text-emerald-400 border border-emerald-900/50"
                            }`}
                          >
                            {item.badgeText}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 group-hover:underline">
                            Detail <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
