"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV = [
  { href: "/workspace", label: "Projects" },
  { href: "/settings", label: "Integrations" },
];

export function ChaiShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[var(--chai-bg)] text-zinc-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--chai-border)] bg-[var(--chai-surface)] md:flex">
        <div className="border-b border-[var(--chai-border)] px-5 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight chai-glare">
            chai.
          </Link>
          <p className="mt-1 text-xs text-zinc-500">Workflow builder</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-indigo-500/15 text-indigo-200"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--chai-border)] p-4 text-xs text-zinc-600">
          Artifacts → Designs → App
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--chai-border)] bg-[var(--chai-surface)]/80 px-5 py-4 backdrop-blur">
          <div>
            {title && (
              <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-zinc-500">{subtitle}</p>
            )}
          </div>
          <Link href="/workspace" className="chai-btn-ghost md:hidden">
            Projects
          </Link>
        </header>
        <main className="flex-1 overflow-auto p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
