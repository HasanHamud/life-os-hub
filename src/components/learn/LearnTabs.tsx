import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { GraduationCap, Lightbulb, Brain, Code, TrendingUp } from "lucide-react";

const TABS = [
  { to: "/learn", label: "learn.title", icon: GraduationCap, exact: true },
  { to: "/learn/insights", label: "learn.insights", icon: Lightbulb },
  { to: "/learn/concepts", label: "learn.concepts", icon: Brain },
  { to: "/learn/problems", label: "learn.problems", icon: Code },
  { to: "/learn/progress", label: "learn.progress", icon: TrendingUp },
];

export function LearnTabs() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex items-center gap-1 border-b mb-6 overflow-x-auto scrollbar-thin">
      {TABS.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? path === to : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors shrink-0",
              active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(label)}
          </Link>
        );
      })}
    </div>
  );
}
