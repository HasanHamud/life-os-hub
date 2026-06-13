import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/tasks", label: "Tasks" },
  { to: "/time", label: "Time" },
  { to: "/calendar", label: "Calendar" },
  { to: "/projects", label: "Projects" },
  { to: "/goals", label: "Goals" },
  { to: "/notes", label: "Notes" },
  { to: "/pomodoro", label: "Pomodoro" },
  { to: "/stopwatch", label: "Stopwatch" },
  { to: "/focus", label: "Focus" },
  { to: "/journal", label: "Journal" },
  { to: "/analytics", label: "Analytics" },
  { to: "/tags", label: "Tags" },
  { to: "/weekly-plan", label: "Weekly" },
  { to: "/learn", label: "Learn" },
  { to: "/learn/insights", label: "Insights" },
  { to: "/learn/concepts", label: "Concepts" },
  { to: "/learn/problems", label: "Problems" },
  { to: "/learn/progress", label: "Progress" },
  { to: "/finance", label: "Finance" },
  { to: "/finance/transactions", label: "Tx" },
  { to: "/finance/accounts", label: "Accounts" },
  { to: "/finance/categories", label: "Cats" },
  { to: "/finance/budgets", label: "Budgets" },
  { to: "/finance/savings", label: "Savings" },
  { to: "/finance/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="md:hidden border-b bg-sidebar">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-warning grid place-items-center text-primary-foreground text-xs font-bold">L</div>
          <span className="text-sm font-semibold">Life OS</span>
        </div>
        <button onClick={() => setOpen(!open)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-sidebar-accent">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="grid grid-cols-3 gap-1 p-2 border-t max-h-[70vh] overflow-y-auto">
          {NAV.map(({ to, label }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-3 py-2 rounded text-xs text-center",
                  active ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
