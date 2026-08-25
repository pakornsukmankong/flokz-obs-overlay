import Link from "next/link";
import { Mic, Swords, Heart, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const tools = [
  {
    href: "/donate-setup",
    icon: Heart,
    title: "Donation Alert",
    desc: "โชว์ alert ตอนมีคนโดเนท (เชื่อม EasyDonate) — ชื่อ+ยอด+ข้อความ อนิเมชั่น neon",
    accent: "text-primary",
  },
  {
    href: "/talk-setup",
    icon: Mic,
    title: "Talk (PNGtuber)",
    desc: "อวตารเปลี่ยนรูปตามเสียงไมค์ พูด = ปากอ้า เงียบ = ปากปิด",
    accent: "text-neon-magenta",
  },
  {
    href: "/grind",
    icon: Swords,
    title: "Grind Counter",
    desc: "จับภาพหน้าจอเกม นับรอบดันอัตโนมัติเมื่อเจอ MISSION START แล้วโชว์บนสตรีม",
    accent: "text-neon-gold",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="pt-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary/80">OBS Overlay Suite</p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-wide text-foreground sm:text-6xl">
          <span className="text-primary text-glow">FLOKZ</span> Overlays
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          ชุดเครื่องมือ overlay สำหรับสตรีมเมอร์ — avatar เปลี่ยนตามเสียง + ตัวนับรอบดันจากภาพหน้าจอ
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className="group">
              <Card className="h-full border-border/70 bg-card/60 p-5 transition hover:border-primary/50 hover:shadow-neon-soft">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/60 ring-1 ring-border">
                    <Icon className={`h-5 w-5 ${t.accent}`} />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold tracking-wide text-foreground">{t.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
