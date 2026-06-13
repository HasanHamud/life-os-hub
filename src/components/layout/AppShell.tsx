import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { FloatingTimer } from "./FloatingTimer";
import { AuthGuard } from "./AuthGuard";
import { useStore } from "@/core/store";
import { useLearnStore } from "@/core/learn-store";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/core/supabase";

export function AppShell() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);
  const learnLoad = useLearnStore((s) => s.load);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAuthReady(true);
      else setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    Promise.all([
      load(),
      learnLoad(),
    ]).catch((e) => console.error("DB load failed", e));
  }, [authReady, load, learnLoad]);

  return (
    <AuthGuard>
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
    </AuthGuard>
  );
}
