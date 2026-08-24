import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="neon-bg">
      <Navbar />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Toaster richColors position="bottom-center" theme="dark" />
    </div>
  );
}
