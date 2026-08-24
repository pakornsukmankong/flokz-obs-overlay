import Link from "next/link";
import { Keyboard, Mic, Swords, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

const tools = [
  {
    href: "/keyboard",
    icon: Keyboard,
    title: "Keyboard Overlay",
    desc: "แสดงคีย์บอร์ดบนสตรีม ปุ่มเด้งตามที่กดจริง — จัด layout แบบลากวาง มีหลาย profile",
    accent: "text-neon-cyan",
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
          ชุดเครื่องมือ overlay สำหรับสตรีมเมอร์ — รันในเครื่องคุณเอง keystroke/เสียง/ภาพ ไม่ออกไปไหน
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
