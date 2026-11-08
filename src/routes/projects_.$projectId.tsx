import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { TaskRow } from "@/components/tasks/TaskCard";
import { personName, usePeople } from "@/core/people";
import { fmt, isDueToday, isOverdue } from "@/core/utils";
import type { Project } from "@/core/types";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

export const Route = createFileRoute("/projects_/$projectId")({
  head: () => ({ meta: [{ title: i18n.t("meta.projects") }] }),
  component: ProjectDashboard,
});

function assignedIds(project: Project) {
  if (project.memberIds?.length) return project.memberIds;
  if (!project.memberIds && project.managerId) return [project.managerId];
  return [];
}

function ProjectDashboard() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const people = usePeople();
  const { projects, tasks, loaded } = useStore();
  const project = projects.find((item) => item.id === projectId);

  if (loaded && !project) {
    return (
      <PageContainer>
        <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t("nav.projects")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("projects.missing")}</p>
      </PageContainer>
    );
  }

  if (!project) return null;

  const linked = tasks.filter((task) => task.projectId === project.id && !task.archived);
  const roots = linked.filter((task) => !task.parentTaskId);
  const done = linked.filter((task) => task.status === "done").length;
  const open = linked.filter((task) => task.status !== "done").length;
  const pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
  const names = assignedIds(project).map((id) => personName(people, id) || t("common.unknown"));
  const counts = [
    [t("projects.total"), linked.length],
    [t("projects.done"), done],
    [t("projects.open"), open],
    [t("projects.dueToday"), linked.filter((task) => isDueToday(task) && task.status !== "done").length],
    [t("projects.overdue"), linked.filter(isOverdue).length],
    [t("projects.inProgress"), linked.filter((task) => task.status === "in_progress").length],
    [t("projects.blocked"), linked.filter((task) => task.status === "blocked").length],
  ] as const;

  return (
    <PageContainer>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t("nav.projects")}
      </Link>
      <PageHeader
        title={project.name}
        description={[project.description, names.join(", ") || t("projects.noMembers")].filter(Boolean).join(" · ")}
        actions={
          <Button onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: "new" }, search: { projectId: project.id } })}>
            {t("projects.addTask")}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{done} / {linked.length}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: project.color }} />
        </div>
        {project.createdAt && (
          <div className="mt-2 text-[10px] text-muted-foreground">{t("projects.created", { date: fmt.date(project.createdAt) })}</div>
        )}
      </div>

      <div className="space-y-1">
        {roots.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">{t("projects.noTasks")}</div>}
        {roots.map((task) => (
          <div key={task.id}>
            <TaskRow task={task} onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })} />
            {tasks.filter((child) => child.parentTaskId === task.id).map((child) => (
              <div key={child.id} className="ms-7">
                <TaskRow task={child} onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: child.id } })} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
