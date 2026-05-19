'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { LoginForm } from './login-form';
import { AppBrand } from '@/components/app-logo';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src="/background.png"
          alt="Basarnas Background"
          fill
          className="object-cover opacity-40 mix-blend-overlay"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90" />
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl opacity-30 pointer-events-none z-0">
        <div className="aspect-[2/1] bg-gradient-to-b from-orange-500/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6 gap-3">
          <AppBrand
            size="xl"
            stacked
            subtitle="Sistem Inventaris Barang Operasional"
          />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px] relative z-10">
        <div className="bg-zinc-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-zinc-800/50 relative overflow-hidden">
          <Suspense fallback={<p className="text-center text-sm text-zinc-500">Memuat...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
