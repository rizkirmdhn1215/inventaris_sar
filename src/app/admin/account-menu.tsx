"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Pencil,
  UserPlus,
  Users,
  Check,
  Loader2,
  Camera,
} from "lucide-react";
import { AccountAvatar } from "./account-avatar";
import { EditAccountModal } from "./edit-account-modal";
import { AddAdminModal } from "./add-admin-modal";
import { logoutAction } from "./actions";
import {
  clearSavedAccounts,
  getSavedAccounts,
  upsertSavedAccount,
  type SavedAccount,
} from "@/lib/auth/saved-accounts";

type AccountMenuProps = {
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminImageUrl: string | null;
  adminNip: string | null;
  adminRole: string;
  locations?: { id: string; name: string }[];
};

export function AccountMenu({
  adminId,
  adminName: initialName,
  adminEmail: initialEmail,
  adminImageUrl: initialImageUrl,
  adminNip: initialNip,
  adminRole,
  locations = [],
}: AccountMenuProps) {
  const router = useRouter();
  const [isLoggingOut, startLogout] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [name, setName] = useState(initialName);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [nip, setNip] = useState(initialNip);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  const isSuperAdmin = adminRole === "superadmin";

  useEffect(() => {
    setName(initialName);
    setImageUrl(initialImageUrl);
    setNip(initialNip);
  }, [initialName, initialImageUrl, initialNip]);

  useEffect(() => {
    async function syncCurrentAccount() {
      try {
        const res = await fetch("/api/auth/account-snapshot");
        if (!res.ok) return;
        const data = (await res.json()) as SavedAccount;
        upsertSavedAccount(data);
        setSavedAccounts(getSavedAccounts());
      } catch {
        setSavedAccounts(getSavedAccounts());
      }
    }
    syncCurrentAccount();
  }, [adminId, name, imageUrl]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onPointerDown);
    }
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function handleSwitchAccount(account: SavedAccount) {
    if (account.adminId === adminId) {
      setOpen(false);
      return;
    }
    setSwitchingId(account.adminId);
    setSwitchError(null);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: account.adminId,
          switchToken: account.switchToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwitchError(data.error ?? "Gagal ganti akun.");
        return;
      }
      upsertSavedAccount(data as SavedAccount);
      setOpen(false);
      router.refresh();
    } catch {
      setSwitchError("Gagal ganti akun.");
    } finally {
      setSwitchingId(null);
    }
  }

  const otherAccounts = savedAccounts.filter((a) => a.adminId !== adminId);

  function handleLogout() {
    setOpen(false);
    startLogout(async () => {
      clearSavedAccounts();
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full hover:bg-zinc-800/80 p-1 pr-2 transition-colors"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <AccountAvatar name={name} imageUrl={imageUrl} />
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-400 hidden sm:block transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open ? (
          <div
            className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl z-50 overflow-hidden"
            role="menu"
          >
            <div className="px-3 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <AccountAvatar name={name} imageUrl={imageUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{name}</p>
                  <p className="text-xs text-zinc-400 truncate">{initialEmail}</p>
                  {nip ? (
                    <p className="text-[10px] text-zinc-500 truncate font-mono">NIP. {nip}</p>
                  ) : null}
                  {isSuperAdmin ? (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                      Super Admin
                    </span>
                  ) : null}
                </div>
                <Check className="w-4 h-4 text-orange-400 shrink-0" />
              </div>
            </div>

            <div className="py-1">
              {!imageUrl ? (
                <MenuButton
                  icon={<Camera className="w-4 h-4" />}
                  label="Tambah foto profil"
                  onClick={() => {
                    setOpen(false);
                    setEditOpen(true);
                  }}
                />
              ) : null}
              <MenuButton
                icon={<Pencil className="w-4 h-4" />}
                label="Edit akun"
                onClick={() => {
                  setEditOpen(true);
                  setOpen(false);
                }}
              />
              {isSuperAdmin ? (
                <MenuButton
                  icon={<UserPlus className="w-4 h-4" />}
                  label="Tambah admin"
                  onClick={() => {
                    setAddAdminOpen(true);
                    setOpen(false);
                  }}
                />
              ) : null}
            </div>

            {(otherAccounts.length > 0 || savedAccounts.length > 0) && (
              <div className="border-t border-zinc-800 py-1">
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  Ganti akun
                </p>
                {switchError ? (
                  <p className="px-3 pb-1 text-xs text-red-400">{switchError}</p>
                ) : null}
                {otherAccounts.map((account) => (
                  <button
                    key={account.adminId}
                    type="button"
                    disabled={switchingId === account.adminId}
                    onClick={() => handleSwitchAccount(account)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800/60 disabled:opacity-50"
                  >
                    <AccountAvatar
                      name={account.name}
                      imageUrl={account.imageUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-100 truncate">{account.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{account.email}</p>
                    </div>
                    {switchingId === account.adminId ? (
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    ) : null}
                  </button>
                ))}
                <Link
                  href="/login?add_account=1"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60"
                >
                  <div className="w-8 h-8 rounded-full border border-dashed border-zinc-600 flex items-center justify-center">
                    <Users className="w-4 h-4 text-zinc-400" />
                  </div>
                  <span>Tambah akun lain</span>
                </Link>
              </div>
            )}

            {savedAccounts.length === 0 ? (
              <div className="border-t border-zinc-800 py-1">
                <Link
                  href="/login?add_account=1"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/60"
                >
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>Tambah akun lain</span>
                </Link>
              </div>
            ) : null}

            <div className="border-t border-zinc-800 py-1">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800/60 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Keluar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <EditAccountModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        adminId={adminId}
        name={name}
        email={initialEmail}
        imageUrl={imageUrl}
        nip={nip}
        onUpdated={(patch) => {
          setName(patch.name);
          setImageUrl(patch.imageUrl);
          setNip(patch.nip);
          router.refresh();
        }}
      />

      {isSuperAdmin ? (
        <AddAdminModal
          open={addAdminOpen}
          onClose={() => setAddAdminOpen(false)}
          locations={locations}
        />
      ) : null}
    </>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60"
    >
      {icon}
      {label}
    </button>
  );
}
