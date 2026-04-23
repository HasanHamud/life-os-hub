import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { addDays, startOfDay, addMinutes, format, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BlockType, TimeBlock } from "@/core/types";
import { cn } from "@/lib/utils";

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
const SLOT_MIN = 30;
const PX_PER_HOUR = 64;

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

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Time Blocks"
        description="Click and drag on the grid to create a block. Click a block to edit. Workday: ${0}–${0}".replace("${0}", `${settings.workdayStart}:00`).replace("${0}", `${settings.workdayEnd}:00`)}
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
              onEdit={(b) => setEditing(b)} />
          ))}
        </div>
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
  day, blocks, tasks, onCreate, onEdit,
}: {
  day: Date; blocks: TimeBlock[]; tasks: any[];
  onCreate: (start: number, end: number) => void;
  onEdit: (b: TimeBlock) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ y0: number; y1: number } | null>(null);
  const dayStart = startOfDay(day).getTime() + HOURS[0] * 3600000;

  const yToTime = (y: number) => {
    const slot = Math.max(0, Math.round(y / (PX_PER_HOUR / 2)) * SLOT_MIN);
    return dayStart + slot * 60_000;
  };
  const timeToY = (ts: number) => ((ts - dayStart) / 60_000) * (PX_PER_HOUR / 60);

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

  const dayBlocks = blocks.filter((b) => format(b.startTime, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));

  return (
    <div ref={ref}
      className="border-l border-t relative select-none"
      style={{ height: HOURS.length * PX_PER_HOUR }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => setDrag(null)}>
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
        return (
          <div key={b.id}
            onClick={(e) => { e.stopPropagation(); onEdit(b); }}
            className={cn("absolute left-1 right-1 rounded border-l-2 px-2 py-1 cursor-pointer overflow-hidden hover:shadow-soft", colors[b.type])}
            style={{ top, height }}>
            <div className="text-[11px] font-medium truncate">{b.title}</div>
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
    </div>
  );
}

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

  useMemo(() => {
    setTitle(block?.title ?? "Time Block");
    setType(block?.type ?? "deep");
    setTaskId(block?.taskId ?? "none");
    setS(format(start, "yyyy-MM-dd'T'HH:mm"));
    setE(format(end, "yyyy-MM-dd'T'HH:mm"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
          })}>{block ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
