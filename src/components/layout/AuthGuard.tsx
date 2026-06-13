import { useEffect, useState } from "react";
import { supabase, clearUserIdCache } from "@/core/supabase";
import type { User } from "@supabase/supabase-js";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    clearUserIdCache();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      clearUserIdCache();
      setUser(session?.user ?? null);
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
