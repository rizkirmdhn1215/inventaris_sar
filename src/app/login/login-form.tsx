"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginActionState } from "./actions";
import { KeyRound, Loader2, ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

export function LoginForm() {
  const searchParams = useSearchParams();
  const addAccount = searchParams.get("add_account") === "1";

  const [state, formAction, pending] = useActionState<LoginActionState | null, FormData>(
    loginAction,
    null
  );

  return (
  <>
      {addAccount ? (
        <p className="mb-4 text-center text-xs text-zinc-400">
          Masuk dengan akun lain. Akun akan tersimpan di perangkat ini agar bisa
          diganti cepat seperti akun Google.
        </p>
      ) : null}

      <form action={formAction} className="space-y-6">
        {state?.error && (
          <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {state.error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-300">Email</label>
          <div className="mt-2 relative">
            <input
              name="email"
              type="email"
              required
              defaultValue={state?.email ?? ""}
              placeholder="admin@sarpadang.go.id"
              className="block w-full rounded-xl border-0 py-2.5 px-4 text-white bg-zinc-950/50 shadow-inner ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300">Password</label>
          <div className="mt-2">
            <PasswordInput
              name="password"
              required
              placeholder="••••••••"
              leftIcon={<KeyRound className="h-5 w-5 text-zinc-600" />}
              inputClassName="block w-full rounded-xl border-0 py-2.5 text-white bg-zinc-950/50 shadow-inner ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-all"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="group relative flex w-full justify-center rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-orange-500 hover:shadow-orange-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {addAccount ? "Simpan & masuk" : "Masuk ke Dashboard"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </div>
      </form>

      {addAccount ? (
        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/admin/dashboard" className="text-orange-400 hover:underline">
            Kembali ke dashboard
          </Link>
        </p>
      ) : null}
    </>
  );
}
