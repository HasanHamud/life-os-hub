import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, format } from "date-fns";
import { formatWhen } from "@/core/utils";
import { BookOpen, Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogEntry, Task } from "@/core/types";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { authState } from "@/core/session";
import { DayPickerButton } from "@/components/journal/DayPicker";

export const Route = createFileRoute("/journal")({
  beforeLoad: () => {
    if (authState().user?.role === "admin") {
      throw redirect({ to: "/admin/journals" });
    }
  },
  head: () => ({ meta: [
    { title: i18n.t("meta.journal") },
    { name: "description", content: i18n.t("journal.description") },
  ]}),
  component: JournalPage,
});

type Scale = 1 | 2 | 3 | 4 | 5;

function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function shiftDay(day: string, amount: number) {
  return format(addDays(parseDay(day), amount), "yyyy-MM-dd");
}

function JournalPage() {
  const { t } = useTranslation();
  const { logs, tasks, upsertLog, deleteLog } = useStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const [day, setDay] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [taskIds, setTaskIds] = useState<string[]>([]);

  const loggedDays = useMemo(
    () => [...new Set(logs.map((entry) => entry.date))].map(parseDay),
    [logs],
  );

  const dayLogs = useMemo(
    () => logs.filter((entry) => entry.date === day).sort((a, b) => a.createdAt - b.createdAt),
    [logs, day],
  );

  const otherDays = useMemo(() => {
    const grouped = new Map<string, LogEntry[]>();
    for (const entry of logs) {
      if (entry.date === day) continue;
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }
    return [...grouped.entries()]
      .map(([date, entries]) => ({
        date,
        count: entries.length,
        preview: [...entries].sort((a, b) => b.createdAt - a.createdAt)[0]?.content ?? "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, day]);

  useEffect(() => {
    setEditingId(null);
    setContent("");
    setMood("");
    setEnergy("");
    setTaskIds([]);
  }, [day]);

  const resetComposer = () => {
    setEditingId(null);
    setContent("");
    setMood("");
    setEnergy("");
    setTaskIds([]);
  };

  const edit = (entry: LogEntry) => {
    setEditingId(entry.id);
    setContent(entry.content);
    setMood(entry.mood ? String(entry.mood) : "");
    setEnergy(entry.energy ? String(entry.energy) : "");
    setTaskIds(entry.relatedTaskIds ?? []);
  };

  const save = async () => {
    const text = content.trim();
    if (!text) return;
    await upsertLog({
      ...(editingId ? { id: editingId } : {}),
      date: day,
      content: text,
      mood: mood ? (Number(mood) as Scale) : undefined,
      energy: energy ? (Number(energy) as Scale) : undefined,
      relatedTaskIds: taskIds,
    });
    resetComposer();
  };

  const remove = (id: string) => {
    toast("Delete this journal entry?", {
      id: `delete-journal-${id}`,
      duration: Infinity,
      action: {
        label: t("common.delete"),
        onClick: async () => {
          await deleteLog(id);
          if (editingIdRef.current === id) resetComposer();
        },
      },
      cancel: { label: t("common.cancel"), onClick: () => {} },
    });
  };

  const taskTitle = (id: string) => tasks.find((task) => task.id === id)?.title ?? "Removed task";

  return (
    <PageContainer>
      <PageHeader
        title={t("journal.title")}
        description={t("journal.description")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDay(shiftDay(day, -1))} aria-label={t("journal.prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DayPickerButton day={day} onChange={setDay} marked={loggedDays} />
            <Button size="sm" variant="outline" onClick={() => setDay(today)}>{t("common.today")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDay(shiftDay(day, 1))} aria-label={t("journal.next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {editingId ? t("journal.edit") : "New entry"} · {formatWhen(parseDay(day), "EEEE, MMMM d")}
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder={t("journal.placeholder")}
              className="resize-none"
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <ScaleInput label="Mood" value={mood} onChange={setMood} />
              <ScaleInput label="Energy" value={energy} onChange={setEnergy} />
            </div>
            <TaskPicker tasks={tasks} selected={taskIds} onChange={setTaskIds} />
            <div className="flex justify-end gap-2 mt-4">
              {editingId && (
                <Button variant="ghost" onClick={resetComposer}>{t("common.cancel")}</Button>
              )}
              <Button onClick={save} disabled={!content.trim()}>
                {editingId ? "Update" : "Add entry"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {dayLogs.length === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {t("journal.noEntry")}
              </div>
            )}
            {dayLogs.map((entry) => (
              <article
                key={entry.id}
                className={cn(
                  "rounded-xl border bg-card p-4",
                  editingId === entry.id && "border-primary",
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {formatWhen(entry.createdAt, "h:mm a")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => edit(entry)}
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label={t("journal.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      aria-label={t("journal.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                {entry.adminNote && (
                  <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2">
                    <div className="text-[10px] font-medium text-muted-foreground">
                      Note from {entry.adminNoteBy || "admin"}
                      {entry.adminNoteAt ? ` · ${formatWhen(entry.adminNoteAt, "MMM d, h:mm a")}` : ""}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{entry.adminNote}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {entry.mood && <span className="text-[10px] text-muted-foreground">mood {entry.mood}/5</span>}
                  {entry.energy && <span className="text-[10px] text-muted-foreground">energy {entry.energy}/5</span>}
                  {(entry.relatedTaskIds ?? []).map((id) => (
                    <span key={id} className="text-[10px] rounded-md border px-1.5 py-0.5 text-muted-foreground">
                      {taskTitle(id)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4 h-fit">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Other days
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin">
            {otherDays.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">{t("journal.noDays")}</div>
            )}
            {otherDays.map((item) => (
              <button
                key={item.date}
                type="button"
                onClick={() => setDay(item.date)}
                className="w-full text-start border-l-2 border-primary/40 pl-3 py-1 hover:bg-muted/40 rounded-r-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {formatWhen(parseDay(item.date), "EEE, MMM d, yyyy")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.count} {item.count === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap line-clamp-2 mt-0.5">{item.preview}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function ScaleInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === String(n) ? "" : String(n))}
            className={cn(
              "h-9 flex-1 rounded text-sm font-medium border transition-colors",
              value === String(n)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function TaskPicker({
  tasks,
  selected,
  onChange,
}: {
  tasks: Task[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const openTasks = useMemo(
    () => tasks.filter((task) => !task.archived).sort((a, b) => b.updatedAt - a.updatedAt),
    [tasks],
  );
  const q = query.trim().toLowerCase();
  const visible = q ? openTasks.filter((task) => task.title.toLowerCase().includes(q)) : openTasks;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const titleOf = (id: string) => tasks.find((task) => task.id === id)?.title ?? "Removed task";

  return (
    <div className="mt-4">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">{t("journal.related")}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:border-destructive hover:text-destructive"
          >
            {titleOf(id)}
            <X className="h-3 w-3" />
          </button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              {selected.length ? "Edit tasks" : "Add tasks"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("journal.search")}
              className="h-8"
            />
            <div className="max-h-64 overflow-y-auto mt-2 space-y-0.5">
              {visible.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">{t("journal.noTasks")}</div>
              )}
              {visible.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggle(task.id)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-sm text-start hover:bg-muted/50"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid place-content-center h-4 w-4 shrink-0 rounded-sm border border-primary",
                      selected.includes(task.id) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {selected.includes(task.id) && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate flex-1">{task.title}</span>
                  {task.status === "done" && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{t("journal.done")}</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
