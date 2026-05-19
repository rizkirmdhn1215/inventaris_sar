import Image from "next/image";
import Link from "next/link";

export const LOGO_PATH = "/logo.png";
export const LOGO_ALT =
  "Logo Minang Rescue — Kantor Pencarian dan Pertolongan Padang";

const SIZES = {
  xs: 28,
  sm: 32,
  md: 36,
  lg: 48,
  xl: 64,
} as const;

export type AppLogoSize = keyof typeof SIZES;

const sizeClass: Record<AppLogoSize, string> = {
  xs: "w-7 h-7",
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

type AppLogoProps = {
  size?: AppLogoSize;
  className?: string;
  priority?: boolean;
};

export function AppLogo({ size = "md", className = "", priority }: AppLogoProps) {
  const dim = SIZES[size];
  return (
    <Image
      src={LOGO_PATH}
      alt={LOGO_ALT}
      width={dim}
      height={dim}
      priority={priority ?? (size === "xl" || size === "lg")}
      className={`${sizeClass[size]} object-contain shrink-0 ${className}`}
    />
  );
}

type AppBrandProps = {
  size?: AppLogoSize;
  title?: string;
  subtitle?: string;
  showText?: boolean;
  href?: string;
  className?: string;
  onClick?: () => void;
  /** Stack logo above text (e.g. login hero). */
  stacked?: boolean;
};

export function AppBrand({
  size = "md",
  title = "Minang Rescue",
  subtitle = "Inventaris Barang · KPP Padang",
  showText = true,
  href,
  className = "",
  onClick,
  stacked = false,
}: AppBrandProps) {
  const content = (
    <>
      <AppLogo size={size} priority={size === "xl"} />
      {showText ? (
        <div className={`min-w-0 ${stacked ? "text-center" : "text-left"}`}>
          <p
            className={`font-semibold leading-tight text-white truncate ${
              size === "xl" ? "text-lg" : size === "lg" ? "text-base" : "text-sm"
            }`}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className={`text-zinc-400 leading-tight truncate ${
                size === "xl" ? "text-xs" : "text-[11px]"
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const baseClass = `flex min-w-0 ${stacked ? "flex-col items-center gap-3 text-center" : "flex-row items-center gap-2"} ${className}`;

  if (href) {
    return (
      <Link href={href} className={`${baseClass} hover:opacity-90 transition-opacity`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} text-left`}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
