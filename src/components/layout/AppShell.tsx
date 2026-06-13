import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { FloatingTimer } from "./FloatingTimer";
import { useStore } from "@/core/store";
import { useLearnStore } from "@/core/learn-store";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/core/supabase";
import { setCurrentUserId } from "@/core/db";

function LoadingScreen() {
  return (
    <div style={{
      height: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#161210",
      color: "#a09888",
      fontFamily: "system-ui, sans-serif",
      fontSize: 14,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, margin: "0 auto 16px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #d4a574, #e8a87c)",
          display: "grid", placeItems: "center",
          color: "#161210", fontWeight: "bold", fontSize: 20,
        }}>L</div>
        <div>Loading…</div>
      </div>
    </div>
  );
}

function AuthenticatedShell() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);
  const learnLoad = useLearnStore((s) => s.load);

  useEffect(() => {
    Promise.all([
      load(),
      learnLoad(),
    ]).catch((e) => console.error("DB load failed", e));
  }, [load, learnLoad]);

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

export function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const u = data.user ?? null;
        setCurrentUserId(u?.id ?? null);
        setAuthed(u !== null);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentUserId(null);
        setAuthed(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setCurrentUserId(u?.id ?? null);
      setAuthed(u !== null);
    });

    return () => {
      cancelled = true;
      sub?.subscription.unsubscribe();
    };
  }, []);

  if (authed === null) {
    return <LoadingScreen />;
  }

  if (!authed) {
    const isAuthPage = window.location.pathname === "/auth";
    if (!isAuthPage) {
      window.location.href = "/auth";
      return null;
    }
    // Show just the auth page (no sidebar, no data loading)
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return <AuthenticatedShell />;
}
