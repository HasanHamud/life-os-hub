import { useEffect, useState, useSyncExternalStore } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { AppBar } from "./AppBar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { FloatingTimer } from "./FloatingTimer";
import { useStore } from "@/core/store";
import { useLearnStore } from "@/core/learn-store";
import { hydrateTimers } from "@/core/timer-store";
import { useTranslation } from "react-i18next";
import { useRouter } from "@tanstack/react-router";
import { applyTheme } from "@/core/theme";
import { applyLocale } from "@/core/locale";
import { authState, setWorkspaceView, subscribeAuth } from "@/core/session";
import { loadNotifications } from "@/core/notifications";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

function AuthenticatedShell() {
  const load = useStore((s) => s.load);
  const loaded = useStore((s) => s.loaded);
  const theme = useStore((s) => s.settings.theme);
  const locale = useStore((s) => s.settings.locale);
  const { t } = useTranslation();
  const router = useRouter();
  const learnLoad = useLearnStore((s) => s.load);
  const view = useSyncExternalStore(subscribeAuth, () => authState().view);
  const viewKey = view?.id ?? "";
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    setReadyKey(null);
    hydrateTimers()
      .then(() => {
        if (cancel) return;
        return Promise.all([load(), learnLoad()]);
      })
      .then(() => {
        if (!cancel) setReadyKey(viewKey);
      })
      .catch((e) => console.error("DB load failed", e));
    return () => {
      cancel = true;
    };
  }, [load, learnLoad, viewKey]);

  useEffect(() => {
    if (loaded) applyTheme(theme);
  }, [loaded, theme]);

  useEffect(() => {
    if (!loaded) return;
    void applyLocale(locale).then(() => router.invalidate());
  }, [loaded, locale, router]);

  useEffect(() => {
    void loadNotifications(false);
    const source = new EventSource("/api/events");
    source.onmessage = () => {
      Promise.all([
        useStore.getState().load(),
        useLearnStore.getState().load(),
      ]).catch((e) => console.error("Bridge reload failed", e));
    };
    source.addEventListener("notification", () => {
      void loadNotifications(true);
    });
    return () => source.close();
  }, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <AppBar menuOpen={menuOpen} onMenu={() => setMenuOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
        {view && (
          <div className="flex items-center justify-between gap-3 border-b bg-warning/15 px-4 py-2 text-sm">
            <span>{t("shell.viewing", { name: view.name })}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setWorkspaceView(null);
                navigate({ to: "/" });
              }}
            >
              {t("shell.backToMine")}
            </Button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {loaded && readyKey === viewKey ? <Outlet /> : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              {t("shell.loadingData")}
            </div>
          )}
        </main>
      </div>
      </div>
      <Toaster />
      {loaded && readyKey === viewKey && <FloatingTimer />}
    </div>
  );
}

export function AppShell() {
  return <AuthenticatedShell />;
}
