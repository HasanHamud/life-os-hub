import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Calendar, Clock, Target, FolderKanban,
  Timer, BarChart3, Tag as TagIcon, BookOpen, Settings as SettingsIcon, Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/time", label: "Time Blocks", icon: Clock },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/pomodoro", label: "Pomodoro", icon: Timer },
  { to: "/focus", label: "Focus", icon: Focus },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/tags", label: "Tags", icon: TagIcon },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

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
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Local-first · IndexedDB
        </div>
      </div>
    </aside>
  );
}
