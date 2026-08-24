"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/talk-setup", label: "Talk", icon: Mic },
  { href: "/grind", label: "Grind", icon: Swords },
];

export function Navbar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          className="mr-2 font-display text-xl font-bold tracking-[0.25em] text-primary text-glow"
        >
          FLOKZ
        </Link>
        <nav className="flex items-center gap-1">
          {items.map((it) => {
            const active = path === it.href || path.startsWith(it.href + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground",
                  active && "bg-primary/15 text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto rounded-full border border-border/70 bg-secondary/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          OBS Overlays
        </span>
      </div>
    </header>
  );
}
