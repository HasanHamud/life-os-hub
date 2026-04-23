import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Trash2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [
    { title: "Journal — Life OS" },
    { name: "description", content: "Daily logs with mood, energy, and links to tasks." },
  ]}),
  component: JournalPage,
});

function JournalPage() {
  const { logs, tasks, upsertLog, deleteLog } = useStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLog = logs.find((l) => l.date === today);

  const [content, setContent] = useState(todayLog?.content ?? "");
  const [mood, setMood] = useState<string>(String(todayLog?.mood ?? ""));
  const [energy, setEnergy] = useState<string>(String(todayLog?.energy ?? ""));
  const [taskId, setTaskId] = useState<string>(todayLog?.relatedTaskId ?? "none");

  // resync if log loaded later
  useMemo(() => {
    if (todayLog) {
      setContent(todayLog.content);
      setMood(String(todayLog.mood ?? ""));
      setEnergy(String(todayLog.energy ?? ""));
      setTaskId(todayLog.relatedTaskId ?? "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog?.id]);

  const save = async () => {
    await upsertLog({
      id: todayLog?.id, date: today, content,
      mood: mood ? (Number(mood) as 1 | 2 | 3 | 4 | 5) : undefined,
      energy: energy ? (Number(energy) as 1 | 2 | 3 | 4 | 5) : undefined,
      relatedTaskId: taskId === "none" ? undefined : taskId,
    });
  };

  const past = [...logs].filter((l) => l.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <PageContainer>
      <PageHeader title="Journal" description="Daily reflection. Track mood, energy, and what you learned." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {format(new Date(), "EEEE, MMMM d")}
          </div>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10}
            placeholder="What happened today? What worked? What's tomorrow's first move?"
            className="resize-none" />
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <ScaleInput label="Mood" value={mood} onChange={setMood} />
            <ScaleInput label="Energy" value={energy} onChange={setEnergy} />
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Related task</div>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tasks.slice(0, 30).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={save}>{todayLog ? "Update" : "Save entry"}</Button>
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Past entries
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {past.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No past entries.</div>}
            {past.map((l) => (
              <div key={l.id} className="border-l-2 border-primary/40 pl-3 group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{l.date}</span>
                  <button onClick={() => deleteLog(l.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs whitespace-pre-wrap line-clamp-4">{l.content}</p>
                <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                  {l.mood && <span>mood {l.mood}/5</span>}
                  {l.energy && <span>energy {l.energy}/5</span>}
                </div>
              </div>
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
          <button key={n} onClick={() => onChange(String(n))}
            className={cn(
              "h-9 flex-1 rounded text-sm font-medium border transition-colors",
              value === String(n)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}>{n}</button>
        ))}
      </div>
    </div>
  );
}
