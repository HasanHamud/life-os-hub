import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Calendar, Clock, Target, FolderKanban,
  Timer, BarChart3, Tag as TagIcon, BookOpen, Settings as SettingsIcon, Focus, Watch,
  Wallet, ArrowLeftRight, Layers, PiggyBank, LineChart, StickyNote,
  GraduationCap, Lightbulb, Brain, Code, TrendingUp, CalendarRange,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemConfig {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  accent?: "primary" | "warning";
}

const NAV: NavItemConfig[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/time", label: "Time Blocks", icon: Clock },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/pomodoro", label: "Pomodoro", icon: Timer },
  { to: "/stopwatch", label: "Stopwatch", icon: Watch },
  { to: "/focus", label: "Focus", icon: Focus },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/tags", label: "Tags", icon: TagIcon },
];

const LEARN_NAV: NavItemConfig[] = [
  { to: "/learn", label: "Learn", icon: GraduationCap, exact: true },
  { to: "/learn/insights", label: "Insights", icon: Lightbulb },
  { to: "/learn/concepts", label: "Concepts", icon: Brain },
  { to: "/learn/problems", label: "Problems", icon: Code },
  { to: "/learn/progress", label: "Progress", icon: TrendingUp },
];

const FINANCE_NAV: NavItemConfig[] = [
  { to: "/finance", label: "Overview", icon: Wallet, exact: true, accent: "warning" },
  { to: "/finance/transactions", label: "Transactions", icon: ArrowLeftRight, accent: "warning" },
  { to: "/finance/accounts", label: "Accounts", icon: Wallet, accent: "warning" },
  { to: "/finance/categories", label: "Categories", icon: Layers, accent: "warning" },
  { to: "/finance/budgets", label: "Budgets", icon: Target, accent: "warning" },
  { to: "/finance/savings", label: "Savings", icon: PiggyBank, accent: "warning" },
  { to: "/finance/analytics", label: "Analytics", icon: LineChart, accent: "warning" },
];

function NavLink({ to, label, icon: Icon, exact, accent = "primary", currentPath }: NavItemConfig & { currentPath: string }) {
  const active = exact ? currentPath === to : currentPath.startsWith(to);
  const color = accent === "warning" ? "text-warning" : "text-primary";
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/80"
      )}
    >
      <Icon className={cn("h-4 w-4", active ? color : "text-muted-foreground group-hover:text-foreground")} />
      <span>{label}</span>
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-5 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
      {children}
    </div>
  );
}

export function Sidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-warning grid place-items-center text-primary-foreground font-display font-bold">
          L
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Life OS</div>
          <div className="text-[11px] text-muted-foreground -mt-0.5">your operating system</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {NAV.map((item) => (
          <NavLink key={item.to} {...item} currentPath={currentPath} />
        ))}

        <SectionHeading>Schedule Planning</SectionHeading>
        <NavLink to="/weekly-plan" label="Weekly Plan" icon={CalendarRange} currentPath={currentPath} />

        <SectionHeading>Learning</SectionHeading>
        {LEARN_NAV.map((item) => (
          <NavLink key={item.to} {...item} currentPath={currentPath} />
        ))}

        <SectionHeading>Finance</SectionHeading>
        {FINANCE_NAV.map((item) => (
          <NavLink key={item.to} {...item} currentPath={currentPath} />
        ))}

        <SectionHeading>Settings</SectionHeading>
        <NavLink to="/settings" label="Settings" icon={SettingsIcon} currentPath={currentPath} />
      </nav>

      <div className="px-4 py-3 border-t text-[11px] text-muted-foreground">
        <button
          onClick={async () => {
            await import("@/core/supabase").then((m) => m.supabase.auth.signOut());
            window.location.href = "/auth";
          }}
          className="flex items-center gap-2 hover:text-foreground transition-colors w-full text-left"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          Sign out
        </button>
      </div>
    </aside>
  );
}