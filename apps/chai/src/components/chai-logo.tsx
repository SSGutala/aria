import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  href?: string | null;
  className?: string;
  showText?: boolean;
};

const sizes = {
  sm: { icon: 14, text: "text-sm", gap: "gap-1.5" },
  md: { icon: 18, text: "text-base", gap: "gap-1.5" },
  lg: { icon: 28, text: "text-3xl", gap: "gap-2" },
  xl: { icon: 36, text: "text-4xl", gap: "gap-2.5" },
  hero: { icon: 52, text: "text-4xl", gap: "gap-3" },
};

export function ChaiLogo({
  size = "md",
  href = "/",
  className,
  showText = true,
}: Props) {
  const s = sizes[size];
  const inner = (
    <span
      className={cn(
        "inline-flex items-center font-medium tracking-tight text-chai-text",
        s.gap,
        s.text,
        className
      )}
    >
      <Heart
        size={s.icon}
        className="fill-chai-pink text-chai-pink shrink-0"
        strokeWidth={1.5}
      />
      {showText && <span>chai</span>}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ChaiMark({ className }: { className?: string }) {
  return (
    <Heart
      size={20}
      className={cn("fill-chai-pink text-chai-pink shrink-0", className)}
      strokeWidth={1.5}
    />
  );
}
