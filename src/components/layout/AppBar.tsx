import { useState, useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { applyLocale, isLocaleId, translateError } from "@/core/locale";
import { authState, logout, subscribeAuth } from "@/core/session";
import { useStore } from "@/core/store";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part[0]).join("");
}

function personTint(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return { background: `oklch(0.9 0.045 ${hue})`, color: `oklch(0.32 0.06 ${hue})` };
}

const PAGES = [
  { to: "/", key: "nav.dashboard", exact: true },
  { to: "/admin/journals", key: "nav.journals" },
  { to: "/admin", key: "nav.admin" },
  { to: "/tasks", key: "nav.tasks" },
  { to: "/calendar", key: "nav.calendar" },
  { to: "/projects", key: "nav.projects" },
  { to: "/goals", key: "nav.goals" },
  { to: "/notes", key: "nav.notes" },
  { to: "/pomodoro", key: "nav.pomodoro" },
  { to: "/stopwatch", key: "nav.stopwatch" },
  { to: "/focus", key: "nav.focus" },
  { to: "/journal", key: "nav.journal" },
  { to: "/analytics", key: "nav.analytics" },
  { to: "/learn", key: "nav.learn" },
  { to: "/finance", key: "nav.finance" },
  { to: "/settings", key: "nav.settings" },
  { to: "/profile", key: "nav.profile" },
];

export function AppBar({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { t } = useTranslation();
  const user = useSyncExternalStore(subscribeAuth, () => authState().user);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const page = PAGES.find((item) => (item.exact ? path === item.to : path.startsWith(item.to)));
  const locale = useStore((s) => s.settings.locale);
  const updateSettings = useStore((s) => s.updateSettings);
  const [accountOpen, setAccountOpen] = useState(false);

  const selectLocale = async (value: string) => {
    if (!isLocaleId(value) || value === locale) return;
    const previous = locale;
    await applyLocale(value);
    try {
      await updateSettings({ locale: value });
    } catch (error) {
      await applyLocale(previous);
      toast.error(translateError(error instanceof Error ? error.message : "Could not save language"));
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground md:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="grid h-11 w-11 place-items-center rounded-md hover:bg-sidebar-accent md:hidden"
        aria-label={menuOpen ? t("appBar.closeMenu") : t("appBar.menu")}
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <Link to="/" className="flex min-w-0 items-center gap-2">
        <img src="/brand.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
        <span className="truncate text-sm font-semibold">{t("brand.lifeOs")}</span>
      </Link>
      {page && (
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:inline">{t(page.key)}</span>
      )}
      <div className="ms-auto flex items-center gap-1">
        <div className="flex h-8 items-center rounded-md bg-sidebar-accent p-0.5" role="group" aria-label={t("appBar.language")}>
          {(["en", "ar"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => void selectLocale(id)}
              className={cn(
                "h-7 min-w-8 rounded px-2 text-[13px]",
                locale === id ? "bg-background text-foreground" : "text-sidebar-foreground/80 hover:text-foreground",
              )}
              aria-pressed={locale === id}
            >
              {id === "en" ? "EN" : "ع"}
            </button>
          ))}
        </div>
        <NotificationBell />
        <Popover open={accountOpen} onOpenChange={setAccountOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full"
              aria-label={t("appBar.profile")}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-xs font-medium"
                  style={personTint(user?.name || user?.id || "life")}
                >
                  {initials(user?.name || "")}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            <Link
              to="/profile"
              onClick={() => setAccountOpen(false)}
              className="mt-3 flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              {t("appBar.profile")}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              {t("common.logOut")}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
