import { useSyncExternalStore } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Calendar, Target, FolderKanban,
  BarChart3, BookOpen, Settings as SettingsIcon, UserRound, Ellipsis,
  Wallet, ArrowLeftRight, Layers, PiggyBank, LineChart,
  GraduationCap, Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { authState, subscribeAuth, viewUserId } from "@/core/session";
import { useStore } from "@/core/store";

interface NavItemConfig {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  exact?: boolean;
  accent?: "primary" | "warning";
  activePaths?: string[];
}

const NAV: NavItemConfig[] = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/tasks", labelKey: "nav.tasks", icon: ListChecks },
  { to: "/calendar", labelKey: "nav.calendar", icon: Calendar },
  { to: "/projects", labelKey: "nav.projects", icon: FolderKanban },
  { to: "/goals", labelKey: "nav.goals", icon: Target },
  { to: "/notes", labelKey: "nav.others", icon: Ellipsis, activePaths: ["/notes", "/pomodoro", "/stopwatch", "/focus"] },
  { to: "/journal", labelKey: "nav.journal", icon: BookOpen },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { to: "/learn", labelKey: "nav.learn", icon: GraduationCap },
];

const FINANCE_NAV: NavItemConfig[] = [
  { to: "/finance", labelKey: "nav.overview", icon: Wallet, exact: true, accent: "warning" },
  { to: "/finance/transactions", labelKey: "nav.transactions", icon: ArrowLeftRight, accent: "warning" },
  { to: "/finance/accounts", labelKey: "nav.accounts", icon: Wallet, accent: "warning" },
  { to: "/finance/categories", labelKey: "nav.categories", icon: Layers, accent: "warning" },
  { to: "/finance/budgets", labelKey: "nav.budgets", icon: Target, accent: "warning" },
  { to: "/finance/savings", labelKey: "nav.savings", icon: PiggyBank, accent: "warning" },
  { to: "/finance/analytics", labelKey: "nav.analytics", icon: LineChart, accent: "warning" },
];

function NavLink({ to, labelKey, icon: Icon, exact, activePaths, currentPath }: NavItemConfig & { currentPath: string }) {
  const { t } = useTranslation();
  const active = activePaths
    ? activePaths.includes(currentPath)
    : exact ? currentPath === to : currentPath.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "group flex h-8 items-center gap-2 rounded-md px-2 text-sm",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80"
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-current" : "text-muted-foreground group-hover:text-foreground")} />
      <span>{t(labelKey)}</span>
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-5 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const user = useSyncExternalStore(subscribeAuth, () => authState().user);
  const financeEnabled = useStore((s) => s.settings.financeEnabled);
  const viewingOther = useSyncExternalStore(subscribeAuth, () => !!viewUserId());

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground">
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <SectionHeading>{t("nav.taskManagement")}</SectionHeading>
        {NAV.map((item) => {
          const link = user?.role === "admin" && item.to === "/journal"
            ? { ...item, to: "/admin/journals", labelKey: "nav.journals" }
            : item;
          return <NavLink key={link.to} {...link} currentPath={currentPath} />;
        })}

        {financeEnabled && !viewingOther && (
          <>
            <SectionHeading>{t("nav.finance")}</SectionHeading>
            {FINANCE_NAV.map((item) => (
              <NavLink key={item.to} {...item} currentPath={currentPath} />
            ))}
          </>
        )}

        <SectionHeading>{t("nav.settings")}</SectionHeading>
        <NavLink to="/settings" labelKey="nav.settings" icon={SettingsIcon} currentPath={currentPath} />
        <NavLink to="/profile" labelKey="nav.profile" icon={UserRound} currentPath={currentPath} />
        {user?.role === "admin" && (
          <NavLink to="/admin" labelKey="nav.admin" icon={Shield} exact currentPath={currentPath} />
        )}
      </nav>
    </aside>
  );
}