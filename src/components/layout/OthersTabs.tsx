import { Link, useRouterState } from "@tanstack/react-router";
import { Focus, StickyNote, Timer, Watch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/notes", label: "nav.notes", icon: StickyNote },
  { to: "/pomodoro", label: "nav.pomodoro", icon: Timer },
  { to: "/stopwatch", label: "nav.stopwatch", icon: Watch },
  { to: "/focus", label: "nav.focus", icon: Focus },
] as const;

export function OthersTabs() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-4 scrollbar-thin">
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = path === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
              active
                ? "border-primary font-medium text-foreground"
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
