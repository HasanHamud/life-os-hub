import { Link, useRouterState } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { authState, subscribeAuth, viewUserId } from "@/core/session";
import { useStore } from "@/core/store";

const NAV: { to: string; labelKey: string; activePaths?: string[] }[] = [
  { to: "/", labelKey: "nav.dashboard" },
  { to: "/tasks", labelKey: "nav.tasks" },
  { to: "/calendar", labelKey: "nav.calendar" },
  { to: "/projects", labelKey: "nav.projects" },
  { to: "/goals", labelKey: "nav.goals" },
  { to: "/notes", labelKey: "nav.others", activePaths: ["/notes", "/pomodoro", "/stopwatch", "/focus"] },
  { to: "/journal", labelKey: "nav.journal" },
  { to: "/analytics", labelKey: "nav.analytics" },
  { to: "/learn", labelKey: "nav.learn" },
  { to: "/settings", labelKey: "nav.settings" },
];

const FINANCE_NAV = [
  { to: "/finance", labelKey: "nav.finance" },
  { to: "/finance/transactions", labelKey: "nav.tx" },
  { to: "/finance/accounts", labelKey: "nav.accounts" },
  { to: "/finance/categories", labelKey: "nav.cats" },
  { to: "/finance/budgets", labelKey: "nav.budgets" },
  { to: "/finance/savings", labelKey: "nav.savings" },
  { to: "/finance/analytics", labelKey: "nav.analytics" },
] as const;

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const user = useSyncExternalStore(subscribeAuth, () => authState().user);
  const financeEnabled = useStore((s) => s.settings.financeEnabled);
  const viewingOther = useSyncExternalStore(subscribeAuth, () => !!viewUserId());
  const journalForRole = (item: { to: string; labelKey: string; activePaths?: string[] }) => (
    user?.role === "admin" && item.to === "/journal"
      ? { to: "/admin/journals", labelKey: "nav.journals" }
      : item
  );
  const items = [
    ...NAV.filter((item) => item.to !== "/settings").map(journalForRole),
    ...(financeEnabled && !viewingOther ? FINANCE_NAV : []),
    ...NAV.filter((item) => item.to === "/settings").map(journalForRole),
    { to: "/profile", labelKey: "nav.profile" },
    ...(user?.role === "admin" ? [{ to: "/admin", labelKey: "nav.admin" }] : []),
  ];

  if (!open) return null;

  return (
    <nav className="grid max-h-[70vh] grid-cols-3 gap-1 overflow-y-auto border-b bg-sidebar p-2 md:hidden">
      {items.map(({ to, labelKey, activePaths }) => {
        const active = activePaths
          ? activePaths.includes(path)
          : to === "/" || to === "/admin" ? path === to : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className={cn(
              "rounded px-3 py-2 text-center text-xs",
              active ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
