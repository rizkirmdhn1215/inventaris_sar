"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  QrCode,
  ClipboardList,
  Undo2,
  LogOut,
  Tags,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { logoutAction } from "./actions";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/kategori", label: "Kategori", icon: Tags },
  { href: "/admin/barang", label: "Barang", icon: Package },
  { href: "/admin/qr-generator", label: "QR Gen", icon: QrCode },
  { href: "/admin/peminjaman", label: "Pinjam", icon: ClipboardList },
  { href: "/admin/pengembalian", label: "Return", icon: Undo2 },
];

export function AdminShell({
  children,
  adminName,
  adminEmail,
  vapidPublicKey,
}: {
  children: ReactNode;
  adminName: string;
  adminEmail: string;
  vapidPublicKey: string;
}) {
  const pathname = usePathname();
  const initial = (adminName?.[0] ?? "A").toUpperCase();
  const [pushState, setPushState] = useState<"idle" | "subscribed" | "denied" | "unsupported" | "loading">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.pushManager.getSubscription().then((sub) => {
        if (sub) setPushState("subscribed");
      });
    });
  }, []);

  async function subscribePush() {
    if (!vapidPublicKey) return;
    try {
      setPushState("loading");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setPushState("subscribed");
    } catch (e) {
      console.error(e);
      setPushState("idle");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur flex items-center justify-between px-4 sm:px-6 h-14 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-xs font-bold">
            SAR
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">SAR Inventory</span>
            <span className="text-xs text-zinc-400">Panel Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {pushState !== "subscribed" && pushState !== "unsupported" && vapidPublicKey ? (
            <button
              onClick={subscribePush}
              disabled={pushState === "loading"}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-orange-500/50 bg-zinc-900/60 disabled:opacity-50"
              title="Aktifkan notifikasi browser"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {pushState === "loading" ? "..." : pushState === "denied" ? "Notif ditolak" : "Aktifkan Notif"}
              </span>
            </button>
          ) : null}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium">{adminName}</span>
            <span className="text-xs text-zinc-400">{adminEmail}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold">
            {initial}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex w-56 flex-col border-r border-zinc-800 bg-zinc-950/80">
          <nav className="flex-1 py-4 space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 pb-20 md:pb-6">
            {children}
          </div>

          <nav className="md:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur fixed bottom-0 inset-x-0 z-20">
            <div className="flex overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex-1 min-w-[64px] flex flex-col items-center justify-center gap-1 py-2 text-[10px]"
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-orange-500" : "text-zinc-400"
                      }`}
                    />
                    <span
                      className={
                        isActive ? "text-orange-500" : "text-zinc-400"
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </main>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
