import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { addDays, startOfDay, addMinutes, format, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { BlockType, TimeBlock, Recurrence, RecurrenceFreq, Task } from "@/core/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/time")({
  head: () => ({
    meta: [
      { title: "Time Blocks — Life OS" },
      { name: "description", content: "Drag-to-create time blocks. Plan your day visually." },
    ],
  }),
  component: TimePage,
});

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am-10pm
const SLOT_MIN = 15;
const PX_PER_HOUR = 64;
const PX_PER_MIN = PX_PER_HOUR / 60;

function TimePage() {
  const { timeBlocks, tasks, settings, upsertBlock, deleteBlock } = useStore();
  const [view, setView] = useState<"day" | "week">("day");
  const [anchor, setAnchor] = useState(startOfDay(new Date()));
  const [editing, setEditing] = useState<TimeBlock | null>(null);
  const [creating, setCreating] = useState<{ start: number; end: number } | null>(null);

  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(anchor, i - anchor.getDay()));

  const goPrev = () => setAnchor(addDays(anchor, view === "day" ? -1 : -7));
  const goNext = () => setAnchor(addDays(anchor, view === "day" ? 1 : 7));
  const goToday = () => setAnchor(startOfDay(new Date()));

  // Unscheduled tasks list (for sidebar drag source)
  const unscheduled = tasks.filter((t) => t.status !== "done");

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Time Blocks"
        description={`Drag tasks onto the grid to schedule. Drag existing blocks to move them. Workday: ${settings.workdayStart}:00–${settings.workdayEnd}:00`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
            <Button size="sm" variant="ghost" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
            <div className="border rounded-md p-0.5 flex">
              <button onClick={() => setView("day")}
                className={cn("px-3 py-1 text-xs rounded", view === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                Day
              </button>
              <button onClick={() => setView("week")}
                className={cn("px-3 py-1 text-xs rounded", view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                Week
              </button>
            </div>
            <Button size="sm" onClick={() => {
              const s = addMinutes(new Date(), 5).getTime();
              setCreating({ start: s, end: s + 3600000 });
            }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_240px] gap-4">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d.getTime()} className={cn(
                "px-3 py-2 border-l text-xs font-medium border-b",
                isToday(d) && "bg-primary/5 text-primary",
              )}>
                <div className="uppercase tracking-wide text-[10px] text-muted-foreground">{format(d, "EEE")}</div>
                <div className="text-sm">{format(d, "MMM d")}</div>
              </div>
            ))}

            <div className="border-t">
              {HOURS.map((h) => (
                <div key={h} style={{ height: PX_PER_HOUR }} className="text-[10px] text-muted-foreground pr-2 text-right pt-0.5 font-mono tabular-nums">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {days.map((d) => (
              <DayColumn key={d.getTime()} day={d} blocks={timeBlocks} tasks={tasks}
                onCreate={(s, e) => setCreating({ start: s, end: e })}
                onEdit={(b) => setEditing(b)}
                onMoveBlock={async (id, newStart) => {
                  const b = timeBlocks.find((x) => x.id === id);
                  if (!b) return;
                  const dur = b.endTime - b.startTime;
                  await upsertBlock({ ...b, startTime: newStart, endTime: newStart + dur });
                  toast.success(`Moved "${b.title}" to ${format(newStart, "MMM d HH:mm")}`);
                }}
                onDropTask={async (taskId, start) => {
                  const t = tasks.find((x) => x.id === taskId);
                  if (!t) return;
                  const dur = (t.effort ?? 60) * 60_000;
                  await upsertBlock({
                    title: t.title, taskId: t.id, type: "deep",
                    startTime: start, endTime: start + dur,
                  });
                  toast.success(`Scheduled "${t.title}" at ${format(start, "HH:mm")}`);
                }}
              />
            ))}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tasks</div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {unscheduled.map((t) => (
              <div key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-task-id", t.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="text-xs px-2 py-1.5 rounded border bg-background cursor-grab hover:border-primary/40">
                {t.title}
                {t.effort && <span className="text-muted-foreground ml-1">· {t.effort}m</span>}
              </div>
            ))}
            {unscheduled.length === 0 && (
              <div className="text-xs text-muted-foreground py-3 text-center">No tasks.</div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground">
            Drag a task onto the grid to create a block at that time.
          </div>
        </aside>
      </div>

      <BlockDialog open={!!editing || !!creating}
        onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(null); } }}
        block={editing}
        defaultStart={creating?.start}
        defaultEnd={creating?.end}
        onDelete={async (id) => { await deleteBlock(id); setEditing(null); }}
        onSave={async (data) => {
          await upsertBlock(data);
          setEditing(null); setCreating(null);
        }}
      />
    </PageContainer>
  );
}

function DayColumn({
  day, blocks, tasks, onCreate, onEdit, onMoveBlock, onDropTask,
}: {
  day: Date; blocks: TimeBlock[]; tasks: Task[];
  onCreate: (start: number, end: number) => void;
  onEdit: (b: TimeBlock) => void;
  onMoveBlock: (id: string, newStart: number) => void;
  onDropTask: (taskId: string, start: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ y0: number; y1: number } | null>(null);
  const [moving, setMoving] = useState<{ id: string; offsetY: number; previewY: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ y: number; label: string } | null>(null);
  const dayStart = startOfDay(day).getTime() + HOURS[0] * 3600000;

  const yToTime = (y: number) => {
    const minutes = Math.max(0, Math.round(y / PX_PER_MIN / SLOT_MIN) * SLOT_MIN);
    return dayStart + minutes * 60_000;
  };
  const timeToY = (ts: number) => ((ts - dayStart) / 60_000) * PX_PER_MIN;

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.target !== ref.current) return;
    const rect = ref.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDrag({ y0: y, y1: y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    const rect = ref.current!.getBoundingClientRect();
    setDrag({ ...drag, y1: e.clientY - rect.top });
  };
  const onMouseUp = () => {
    if (!drag) return;
    const a = Math.min(drag.y0, drag.y1), b = Math.max(drag.y0, drag.y1);
    if (b - a < 6) { setDrag(null); return; }
    const s = yToTime(a), e = Math.max(yToTime(b), s + 30 * 60_000);
    onCreate(s, e);
    setDrag(null);
  };

  // HTML5 DnD for moving blocks & dropping tasks
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = ref.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (moving) {
      const previewY = timeToY(yToTime(y - moving.offsetY));
      setMoving({ ...moving, previewY });
      setDropPreview({ y: previewY, label: format(yToTime(y - moving.offsetY), "HH:mm") });
    } else {
      const snapY = timeToY(yToTime(y));
      setDropPreview({ y: snapY, label: format(yToTime(y), "HH:mm") });
    }
  };
  const onDragLeave = () => { setDropPreview(null); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = ref.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const taskId = e.dataTransfer.getData("application/x-task-id");
    const blockId = e.dataTransfer.getData("application/x-block-id");
    if (blockId) {
      const offsetY = moving?.offsetY ?? 0;
      onMoveBlock(blockId, yToTime(y - offsetY));
    } else if (taskId) {
      onDropTask(taskId, yToTime(y));
    }
    setMoving(null);
    setDropPreview(null);
  };

  const dayBlocks = blocks.filter((b) => format(b.startTime, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));

  return (
    <div ref={ref}
      className="border-l border-t relative select-none"
      style={{ height: HOURS.length * PX_PER_HOUR }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => setDrag(null)}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {HOURS.map((h, i) => (
        <div key={h} className="border-b border-border/40 absolute left-0 right-0" style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }} />
      ))}
      {dayBlocks.map((b) => {
        const top = timeToY(b.startTime);
        const height = Math.max(20, timeToY(b.endTime) - top);
        const linked = b.taskId ? tasks.find((t) => t.id === b.taskId) : undefined;
        const colors: Record<BlockType, string> = {
          deep: "bg-primary/15 border-l-primary text-foreground",
          shallow: "bg-info/15 border-l-info text-foreground",
          personal: "bg-success/15 border-l-success text-foreground",
        };
        const isMoving = moving?.id === b.id;
        return (
          <div key={b.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-block-id", b.id);
              e.dataTransfer.effectAllowed = "move";
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setMoving({ id: b.id, offsetY: e.clientY - rect.top, previewY: top });
            }}
            onDragEnd={() => { setMoving(null); setDropPreview(null); }}
            onClick={(e) => { e.stopPropagation(); onEdit(b); }}
            className={cn("absolute left-1 right-1 rounded border-l-2 px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden hover:shadow-soft", colors[b.type], isMoving && "opacity-40")}
            style={{ top, height }}>
            <div className="text-[11px] font-medium truncate flex items-center gap-1">
              {b.recurrence && b.recurrence.freq !== "none" && <Repeat className="h-3 w-3 text-muted-foreground" />}
              {b.title}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {format(b.startTime, "HH:mm")}–{format(b.endTime, "HH:mm")}
            </div>
            {linked && <div className="text-[10px] text-muted-foreground truncate">↳ {linked.title}</div>}
          </div>
        );
      })}
      {drag && (
        <div className="absolute left-1 right-1 rounded bg-primary/20 border border-primary/40 pointer-events-none"
          style={{ top: Math.min(drag.y0, drag.y1), height: Math.abs(drag.y1 - drag.y0) }} />
      )}
      {dropPreview && (
        <div className="absolute left-0 right-0 pointer-events-none border-t-2 border-dashed border-primary"
          style={{ top: dropPreview.y }}>
          <div className="absolute -top-2 left-1 text-[10px] font-mono bg-primary text-primary-foreground px-1 rounded">
            {dropPreview.label}
          </div>
        </div>
      )}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function BlockDialog({
  open, onOpenChange, block, defaultStart, defaultEnd, onSave, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  block: TimeBlock | null; defaultStart?: number; defaultEnd?: number;
  onSave: (data: Partial<TimeBlock>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const tasks = useStore((s) => s.tasks);
  const start = block?.startTime ?? defaultStart ?? Date.now();
  const end = block?.endTime ?? defaultEnd ?? start + 3600000;

  const [title, setTitle] = useState(block?.title ?? "Time Block");
  const [type, setType] = useState<BlockType>(block?.type ?? "deep");
  const [taskId, setTaskId] = useState<string>(block?.taskId ?? "none");
  const [s, setS] = useState(format(start, "yyyy-MM-dd'T'HH:mm"));
  const [e, setE] = useState(format(end, "yyyy-MM-dd'T'HH:mm"));
  const [recFreq, setRecFreq] = useState<RecurrenceFreq>(block?.recurrence?.freq ?? "none");
  const [recWeekdays, setRecWeekdays] = useState<number[]>(block?.recurrence?.weekdays ?? []);
  const [recInterval, setRecInterval] = useState<number>(block?.recurrence?.intervalDays ?? 2);
  const [recUntil, setRecUntil] = useState<string>(block?.recurrence?.until ? format(block.recurrence.until, "yyyy-MM-dd") : "");

  useEffect(() => {
    setTitle(block?.title ?? "Time Block");
    setType(block?.type ?? "deep");
    setTaskId(block?.taskId ?? "none");
    setS(format(start, "yyyy-MM-dd'T'HH:mm"));
    setE(format(end, "yyyy-MM-dd'T'HH:mm"));
    setRecFreq(block?.recurrence?.freq ?? "none");
    setRecWeekdays(block?.recurrence?.weekdays ?? []);
    setRecInterval(block?.recurrence?.intervalDays ?? 2);
    setRecUntil(block?.recurrence?.until ? format(block.recurrence.until, "yyyy-MM-dd") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleWeekday = (d: number) => {
    setRecWeekdays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const buildRecurrence = (): Recurrence | undefined => {
    if (recFreq === "none") return undefined;
    const r: Recurrence = { freq: recFreq };
    if (recFreq === "weekly") r.weekdays = recWeekdays.length > 0 ? recWeekdays : [new Date(s).getDay()];
    if (recFreq === "custom") r.intervalDays = Math.max(1, recInterval);
    if (recUntil) r.until = new Date(recUntil + "T23:59").getTime();
    return r;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{block ? "Edit Block" : "New Time Block"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(ev) => setTitle(ev.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Start</Label><Input type="datetime-local" value={s} onChange={(ev) => setS(ev.target.value)} /></div>
            <div><Label className="text-xs">End</Label><Input type="datetime-local" value={e} onChange={(ev) => setE(ev.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as BlockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deep">Deep work</SelectItem>
                  <SelectItem value="shallow">Shallow / admin</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Linked task</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.filter((t) => t.status !== "done").map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs font-semibold">Recurrence</Label>
            </div>
            <Select value={recFreq} onValueChange={(v) => setRecFreq(v as RecurrenceFreq)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly">Weekly (pick days)</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>

            {recFreq === "weekly" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((label, idx) => (
                  <label key={idx} className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer",
                    recWeekdays.includes(idx) ? "bg-primary/15 border-primary/40 text-primary" : "border-border"
                  )}>
                    <Checkbox checked={recWeekdays.includes(idx)} onCheckedChange={() => toggleWeekday(idx)} />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {recFreq === "custom" && (
              <div className="mt-2">
                <Label className="text-xs">Repeat every (days)</Label>
                <Input type="number" min={1} value={recInterval}
                  onChange={(ev) => setRecInterval(parseInt(ev.target.value || "1"))} />
              </div>
            )}

            {recFreq !== "none" && (
              <div className="mt-2">
                <Label className="text-xs">Until (optional)</Label>
                <Input type="date" value={recUntil} onChange={(ev) => setRecUntil(ev.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          {block && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => onDelete(block.id)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({
            id: block?.id, title, type,
            startTime: new Date(s).getTime(),
            endTime: new Date(e).getTime(),
            taskId: taskId === "none" ? undefined : taskId,
            recurrence: buildRecurrence(),
          })}>{block ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}