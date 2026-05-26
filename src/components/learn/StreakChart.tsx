import { cn } from "@/lib/utils";
import { subDays, format, isSameDay } from "date-fns";

export function StreakChart({
  sessionDates,
}: {
  sessionDates: string[];
}) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    return {
      date: d,
      label: format(d, "d"),
      active: sessionDates.some((s) => s === format(d, "yyyy-MM-dd")),
    };
  });

  const streak = () => {
    let count = 0;
    const today = format(new Date(), "yyyy-MM-dd");
    for (let i = days.length - 1; i >= 0; i--) {
      const d = format(days[i].date, "yyyy-MM-dd");
      if (sessionDates.includes(d)) count++;
      else if (d < today) break;
    }
    return count;
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-medium">🔥 {streak()}-day streak</span>
      </div>
      <div className="flex items-center gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={cn(
              "h-3 flex-1 rounded-[2px]",
              d.active ? "bg-primary" : "bg-muted",
            )}
            title={format(d.date, "MMM d")}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>{format(days[0].date, "MMM d")}</span>
        <span>{format(days[days.length - 1].date, "MMM d")}</span>
      </div>
    </div>
  );
}
