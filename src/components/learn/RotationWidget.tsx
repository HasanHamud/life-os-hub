import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";
import { useLearnStore } from "@/core/learn-store";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RotationWidget({
  onConfigure,
}: {
  onConfigure: () => void;
}) {
  const rotation = useLearnStore((s) => s.rotation);
  const today = new Date().getDay();
  const sorted = [...rotation].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly Rotation
        </div>
        <button onClick={onConfigure} className="h-6 w-6 rounded-md hover:bg-accent grid place-items-center">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {sorted.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "text-center rounded-md py-2 px-1",
              entry.dayOfWeek === today
                ? "bg-primary/15 ring-1 ring-primary"
                : "bg-muted/30",
              !entry.enabled && "opacity-40",
            )}
          >
            <div className="text-[10px] font-medium text-muted-foreground">{DAY_NAMES[entry.dayOfWeek]}</div>
            <div className="text-xs mt-0.5">{entry.icon}</div>
            <div className={cn(
              "text-[9px] font-semibold mt-0.5 truncate",
              entry.dayOfWeek === today ? "text-primary" : "text-foreground/80",
              !entry.enabled && "text-muted-foreground",
            )}>
              {entry.enabled ? entry.subject : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
