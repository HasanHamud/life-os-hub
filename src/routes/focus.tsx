import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/core/store";
import { taskScore } from "@/core/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { TaskDialog } from "@/components/tasks/TaskDialog";

export const Route = createFileRoute("/focus")({
  head: () => ({ meta: [
    { title: "Focus Mode — Life OS" },
    { name: "description", content: "Distraction-free single-task focus view." },
  ]}),
  component: FocusPage,
});

function FocusPage() {
  const { tasks, projects, setTaskStatus } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("all");

  const candidates = [...tasks]
    .filter((t) => t.status !== "done" && !t.archived && (projectId === "all" || t.projectId === projectId))
    .sort((a, b) => taskScore(b) - taskScore(a));
  const current = selectedId ? tasks.find((t) => t.id === selectedId) : candidates[0];

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-surface">
      <div className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Exit focus
        </Link>
        <div className="text-xs text-muted-foreground">Focus Mode</div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {!current ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">✨</div>
            <h1 className="text-2xl font-display font-semibold">Inbox empty</h1>
            <p className="text-muted-foreground mt-2 text-sm">No active tasks. Take a breath, or plan something new.</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-6">One thing at a time</div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold leading-tight text-balance mb-6">
              {current.title}
            </h1>
            {current.description && (
              <p className="text-base text-muted-foreground text-pretty max-w-xl mx-auto mb-10">{current.description}</p>
            )}
            <div className="flex items-center justify-center gap-2 mb-10">
              <Button size="lg" onClick={async () => { await setTaskStatus(current.id, "done"); setSelectedId(null); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
              </Button>
              <Button size="lg" variant="outline" onClick={() => setOpen(true)}>Edit</Button>
              <Link to="/pomodoro" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 h-10 text-sm hover:bg-accent">
                Start Pomodoro →
              </Link>
            </div>

            {candidates.length > 1 && (
              <div className="text-left mt-12">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Up next</div>
                <div className="space-y-1">
                  {candidates.slice(0, 5).filter((t) => t.id !== current.id).map((t) => (
                    <button key={t.id} onClick={() => setSelectedId(t.id)}
                      className="w-full text-left text-sm py-2 px-3 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors">
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <TaskDialog open={open} onOpenChange={setOpen} taskId={current?.id} />
    </div>
  );
}
