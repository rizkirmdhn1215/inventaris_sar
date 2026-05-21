"use client";

import Image from "next/image";

type AccountAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
};

export function AccountAvatar({
  name,
  imageUrl,
  size = "md",
  className = "",
}: AccountAvatarProps) {
  const initial = (name?.[0] ?? "A").toUpperCase();
  const dim = sizeClass[size];

  if (imageUrl) {
    const isLocalPreview = imageUrl.startsWith("blob:") || imageUrl.startsWith("data:");
    return (
      <div
        className={`${dim} rounded-full overflow-hidden relative shrink-0 bg-zinc-800 ${className}`}
      >
        {isLocalPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-zinc-800 flex items-center justify-center font-semibold shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
}
