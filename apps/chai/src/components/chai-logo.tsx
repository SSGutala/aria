import { Heart } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
};

const sizes = {
  sm: { icon: 14, text: "text-sm" },
  md: { icon: 18, text: "text-base" },
  lg: { icon: 28, text: "text-3xl" },
};

export function ChaiLogo({ size = "md", href = "/", className }: Props) {
  const s = sizes[size];
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium tracking-tight text-chai-text",
        s.text,
        className
      )}
    >
      <Heart
        size={s.icon}
        className="fill-chai-pink text-chai-pink"
        strokeWidth={1.5}
      />
      <span>chai</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
