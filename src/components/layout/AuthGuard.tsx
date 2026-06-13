import { useEffect, useState } from "react";
import { supabase } from "@/core/supabase";
import { setCurrentUserId } from "@/core/db";
import type { User } from "@supabase/supabase-js";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user ?? null;
      setCurrentUserId(u?.id ?? null);
      setUser(u);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setCurrentUserId(u?.id ?? null);
      setUser(u);
    });

    return () => sub?.subscription.unsubscribe();
  }, []);

  if (user === "loading") {
    return (
      <div className="h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    const currentPath = window.location.pathname;
    if (currentPath !== "/auth") {
      window.location.href = "/auth";
    }
    return null;
  }

  return <>{children}</>;
}
