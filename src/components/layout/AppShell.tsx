import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { FloatingTimer } from "./FloatingTimer";
import { useStore } from "@/core/store";
import { Toaster } from "@/components/ui/sonner";

export function AppShell() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    load().catch((e) => console.error("DB load failed", e));
  }, [load]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          {loaded ? <Outlet /> : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              Loading your data…
            </div>
          )}
        </main>
      </div>
      <Toaster />
      <FloatingTimer />
      
    </div>
  );
}
