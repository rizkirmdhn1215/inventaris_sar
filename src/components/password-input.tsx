"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  leftIcon?: ReactNode;
  inputClassName?: string;
  wrapperClassName?: string;
};

export function PasswordInput({
  leftIcon,
  inputClassName = "",
  wrapperClassName = "",
  className: _ignored,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      {leftIcon ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {leftIcon}
        </div>
      ) : null}
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${leftIcon ? "pl-10" : "pl-3"} pr-10 ${inputClassName}`}
      />
      <button
        type="button"
        tabIndex={0}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 focus:outline-none focus:text-orange-400"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
        )}
      </button>
    </div>
  );
}
