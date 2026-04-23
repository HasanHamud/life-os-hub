import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, addDays,
  format, isToday, isSameMonth, isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Life OS" },
      { name: "description", content: "Month, week and day views with task deadlines and time blocks." },
    ],
  }),
  component: CalendarPage,
});

type View = "month" | "week" | "day";

function CalendarPage() {
  const { tasks, timeBlocks, upsertTask } = useStore();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [dragId, setDragId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(anchor)),
        end: endOfWeek(endOfMonth(anchor)),
      });
    }
    if (view === "week") {
      return eachDayOfInterval({ start: startOfWeek(anchor), end: endOfWeek(anchor) });
    }
    return [anchor];
  }, [view, anchor]);

  const goPrev = () => setAnchor(view === "month" ? addMonths(anchor, -1) : addDays(anchor, view === "week" ? -7 : -1));
  const goNext = () => setAnchor(view === "month" ? addMonths(anchor, 1) : addDays(anchor, view === "week" ? 7 : 1));

  const dropOn = async (day: Date) => {
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    if (!t) return;
    const target = t.deadline ? new Date(t.deadline) : new Date();
    target.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    await upsertTask({ ...t, deadline: target.getTime() });
    setDragId(null);
  };

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Calendar"
        description="Drag tasks onto days to schedule them. Click any day to see details."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button size="sm" variant="ghost" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
            <div className="border rounded-md p-0.5 flex">
              {(["month", "week", "day"] as View[]).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn("px-3 py-1 text-xs rounded capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="rounded-xl border bg-card p-3">
          <div className="text-sm font-display font-semibold mb-3">{format(anchor, "MMMM yyyy")}</div>
          {view === "month" ? (
            <>
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground py-1 px-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {range.map((day) => {
                  const dayTasks = tasks.filter((t) => t.deadline && isSameDay(t.deadline, day));
                  const dayBlocks = timeBlocks.filter((b) => isSameDay(b.startTime, day));
                  return (
                    <div key={day.toISOString()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropOn(day)}
                      className={cn(
                        "min-h-[88px] rounded-md border p-1.5 text-xs transition-colors",
                        isSameMonth(day, anchor) ? "bg-background" : "bg-muted/30 text-muted-foreground",
                        isToday(day) && "border-primary",
                      )}>
                      <div className={cn("text-[11px] font-medium tabular-nums mb-1", isToday(day) && "text-primary")}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((t) => (
                          <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                            className="truncate text-[10px] px-1 py-0.5 rounded bg-primary/15 text-primary cursor-grab">
                            {t.title}
                          </div>
                        ))}
                        {dayBlocks.slice(0, 2).map((b) => (
                          <div key={b.id} className="truncate text-[10px] px-1 py-0.5 rounded bg-info/15 text-info">
                            ◷ {b.title}
                          </div>
                        ))}
                        {(dayTasks.length + dayBlocks.length) > 5 && (
                          <div className="text-[10px] text-muted-foreground">+{dayTasks.length + dayBlocks.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={cn("grid gap-2", view === "week" ? "grid-cols-7" : "grid-cols-1")}>
              {range.map((day) => {
                const dayTasks = tasks.filter((t) => t.deadline && isSameDay(t.deadline, day));
                const dayBlocks = timeBlocks.filter((b) => isSameDay(b.startTime, day)).sort((a, b) => a.startTime - b.startTime);
                return (
                  <div key={day.toISOString()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(day)}
                    className={cn("rounded-md border p-3 min-h-[280px]", isToday(day) && "border-primary")}>
                    <div className="text-sm font-medium mb-2">
                      <div className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE")}</div>
                      {format(day, "MMM d")}
                    </div>
                    <div className="space-y-1">
                      {dayBlocks.map((b) => (
                        <div key={b.id} className="text-[11px] px-2 py-1 rounded bg-info/10 text-info">
                          <div className="font-mono">{format(b.startTime, "HH:mm")}–{format(b.endTime, "HH:mm")}</div>
                          <div className="truncate">{b.title}</div>
                        </div>
                      ))}
                      {dayTasks.map((t) => (
                        <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                          className="text-[11px] px-2 py-1 rounded bg-primary/10 text-foreground cursor-grab truncate">
                          • {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-xl border bg-card p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Unscheduled</div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {tasks.filter((t) => !t.deadline && t.status !== "done").map((t) => (
              <div key={t.id} draggable onDragStart={() => setDragId(t.id)}
                className="text-xs px-2 py-1.5 rounded border bg-background cursor-grab hover:border-primary/40">
                {t.title}
              </div>
            ))}
            {tasks.filter((t) => !t.deadline && t.status !== "done").length === 0 && (
              <div className="text-xs text-muted-foreground py-3 text-center">All caught up.</div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground">
            Drag tasks from here onto days. Need to add tasks? <Link to="/tasks" className="text-primary hover:underline">Tasks page →</Link>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
