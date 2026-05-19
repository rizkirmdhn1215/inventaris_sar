"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  titleIcon?: ReactNode;
  children: ReactNode;
};

/** Centered dialog — portaled above admin shell / page content */
export function Modal({ open, onClose, title, titleIcon, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Tutup"
      />
      <div className="fixed inset-0 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div
            className="relative w-full max-w-md max-h-[min(90dvh,calc(100%-2rem))] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 shrink-0 px-4 py-3 border-b border-zinc-800">
              {titleIcon}
              <h2 className="text-sm font-semibold text-white flex-1">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto min-h-0">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
