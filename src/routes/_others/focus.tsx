import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/core/store";
import { taskScore } from "@/core/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

export const Route = createFileRoute("/_others/focus")({
  head: () => ({ meta: [
    { title: i18n.t("meta.focus") },
    { name: "description", content: i18n.t("meta.focusDesc") },
  ]}),
  component: FocusPage,
});

function FocusPage() {
  const { t } = useTranslation();
  const { tasks, projects, setTaskStatus } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("all");

  const candidates = [...tasks]
    .filter((task) => task.status !== "done" && !task.archived && (projectId === "all" || task.projectId === projectId))
    .sort((a, b) => taskScore(b) - taskScore(a));
  const current = selectedId ? tasks.find((task) => task.id === selectedId) : candidates[0];

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-surface">
      <div className="px-6 py-4 flex items-center justify-between gap-3">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t("focusPage.exit")}
        </Link>
        <div className="flex items-center gap-3">
          <Select value={projectId} onValueChange={(v) => { setProjectId(v); setSelectedId(null); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allProjects")}</SelectItem>
              {projects.filter((p) => !p.archived).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">{t("focusPage.mode")}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {!current ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">✨</div>
            <h1 className="text-2xl font-display font-semibold">{t("focusPage.empty")}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{t("focusPage.emptyHelp")}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-6">{t("focusPage.one")}</div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold leading-tight text-balance mb-6">
              {current.title}
            </h1>
            {current.description && (
              <p className="text-base text-muted-foreground text-pretty max-w-xl mx-auto mb-10">{current.description}</p>
            )}
            <div className="flex items-center justify-center gap-2 mb-10">
              <Button size="lg" onClick={async () => { await setTaskStatus(current.id, "done"); setSelectedId(null); }}>
                <CheckCircle2 className="h-4 w-4 me-1" /> {t("focusPage.complete")}
              </Button>
              <Link to="/tasks/$taskId" params={{ taskId: current.id }} className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 h-10 text-sm hover:bg-accent">
                {t("common.edit")}
              </Link>
              <Link to="/pomodoro" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 h-10 text-sm hover:bg-accent">
                {t("focusPage.pomodoro")}
              </Link>
            </div>

            {candidates.length > 1 && (
              <div className="text-start mt-12">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{t("focusPage.upNext")}</div>
                <div className="space-y-1">
                  {candidates.slice(0, 5).filter((task) => task.id !== current.id).map((task) => (
                    <button key={task.id} onClick={() => setSelectedId(task.id)}
                      className="w-full text-start text-sm py-2 px-3 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors">
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
