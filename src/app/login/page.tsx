'use client';

import { useActionState } from 'react';
import { loginAction, type LoginActionState } from './actions';
import { Shield, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginActionState | null, FormData>(
    loginAction,
    null
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Image with 60% dim (40% opacity) */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/background.png"
          alt="Basarnas Background"
          fill
          className="object-cover opacity-40 mix-blend-overlay"
          priority
        />
        {/* Dark gradient overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90"></div>
      </div>

      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl opacity-30 pointer-events-none z-0">
        <div className="aspect-[2/1] bg-gradient-to-b from-orange-500/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 border border-orange-400/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-white">
          SAR Inventory
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Sistem Manajemen Peminjaman Barang Operasional
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px] relative z-10">
        <div className="bg-zinc-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-zinc-800/50 relative overflow-hidden">
          
          <form action={formAction} className="space-y-6">
            {state?.error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Email
              </label>
              <div className="mt-2 relative">
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={state?.email ?? ''}
                  placeholder="admin@sarpadang.go.id"
                  className="block w-full rounded-xl border-0 py-2.5 px-4 text-white bg-zinc-950/50 shadow-inner ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-zinc-600" />
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-white bg-zinc-950/50 shadow-inner ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-600 focus:ring-2 focus:ring-inset focus:ring-orange-500 sm:text-sm sm:leading-6 transition-all"
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
                    Masuk ke Dashboard
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
