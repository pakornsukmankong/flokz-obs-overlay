"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Keyboard, Mic, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/keyboard", label: "คีย์บอร์ด", icon: Keyboard },
  { href: "/talk-setup", label: "Talk", icon: Mic },
  { href: "/grind", label: "Grind", icon: Swords },
];

function ServerStatus() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let stop = false;
    const connect = () => {
      if (stop) return;
      ws = new WebSocket(`ws://${location.host}`);
      ws.addEventListener("open", () => setLive(true));
      ws.addEventListener("close", () => { setLive(false); setTimeout(connect, 2000); });
      ws.addEventListener("error", () => ws?.close());
    };
    connect();
    return () => { stop = true; ws?.close(); };
  }, []);
  return (
    <span className="flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))] animate-pulse-glow" : "bg-destructive")} />
      {live ? "server เชื่อมต่อ" : "ไม่พบ server"}
    </span>
  );
}

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
                <span className="hidden sm:inline">{it.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <ServerStatus />
        </div>
      </div>
    </header>
  );
}
