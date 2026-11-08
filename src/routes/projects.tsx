import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useSyncExternalStore } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { projectProgress, fmt } from "@/core/utils";
import { personName, usePeople } from "@/core/people";
import { authState, subscribeAuth } from "@/core/session";
import { Plus, FolderKanban, Trash2 } from "lucide-react";
import { PROJECT_CATEGORY_PRESETS, type Project } from "@/core/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

function assignedIds(project: Project, selfId?: string) {
  if (project.memberIds) return project.memberIds;
  if (project.managerId && project.managerId !== selfId) return [project.managerId];
  return [];
}

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [
    { title: i18n.t("meta.projects") },
    { name: "description", content: "Group tasks under projects, track progress and feature breakdown." },
  ]}),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const people = usePeople();
  const me = useSyncExternalStore(subscribeAuth, () => authState().user);
  const { projects, tasks, upsertProject, deleteProject } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const allCategories = Array.from(
    new Set([...PROJECT_CATEGORY_PRESETS, ...projects.map((p) => p.category).filter(Boolean) as string[]]),
  );
  const visibleProjects = projects.filter((p) => {
    if (showArchived ? !p.archived : p.archived) return false;
    if (categoryFilter && (p.category ?? "") !== categoryFilter) return false;
    return true;
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("projects.title")}
        description="Initiatives that group related tasks. Each shows progress and a task tree."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? "Active" : t("common.archived")}
            </Button>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 me-1" /> {t("projects.new")}</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button onClick={() => setCategoryFilter("")}
          className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors",
            categoryFilter === "" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
          {t("common.all")}
        </button>
        {allCategories.map((c) => {
          const on = categoryFilter === c;
          return (
            <button key={c} onClick={() => setCategoryFilter(on ? "" : c)}
              className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProjects.map((p) => {
          const pct = projectProgress(p.id, tasks);
          const linked = tasks.filter((task) => task.projectId === p.id);
          const total = linked.length;
          const done = linked.filter((task) => task.status === "done").length;
          const names = assignedIds(p, me?.id).map((id) => personName(people, id) || t("common.unknown"));
          const ownerId = (p as Project & { userId?: string }).userId;
          const canEdit = me?.role === "admin" || !ownerId || ownerId === me?.id;
          return (
            <div key={p.id}
              onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
              className="rounded-xl border bg-card p-5 cursor-pointer hover:border-primary/40 transition-all hover:shadow-soft">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg grid place-items-center" style={{ backgroundColor: `${p.color}25`, color: p.color }}>
                  <FolderKanban className="h-5 w-5" />
                </div>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); setEditing(p.id); }}
                    className="text-xs text-muted-foreground hover:text-foreground">{t("projects.edit")}</button>
                )}
              </div>
              <div className="text-base font-semibold mb-1">{p.name}</div>
              {(p.category || names.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {p.category && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {p.category}
                    </span>
                  )}
                  {names.length > 0 && (
                    <span className="text-[10px] text-muted-foreground truncate">{names.join(", ")}</span>
                  )}
                </div>
              )}
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span>{done} / {total} tasks</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-3">{t("projects.created", { date: fmt.date(p.createdAt) })}</div>
            </div>
          );
        })}

        {visibleProjects.length === 0 && (
          <div className="col-span-full text-center py-16 text-sm text-muted-foreground">
            {showArchived ? "No archived projects." : 'No projects yet. Click "New Project" to start.'}
          </div>
        )}
      </div>

      <ProjectDialog open={creating || !!editing}
        projectId={editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        onSubmit={async (data) => {
          await upsertProject({
            id: editing ?? undefined,
            ...data,
            managerId: me?.role === "admin" ? me.id : undefined,
          });
          setCreating(false); setEditing(null);
        }}
        onDelete={editing ? async () => { await deleteProject(editing); setEditing(null); } : undefined}
      />

    </PageContainer>
  );
}

function ProjectDialog({
  open, onOpenChange, projectId, onSubmit, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; projectId: string | null;
  onSubmit: (d: { name: string; description?: string; color?: string; category?: string; memberIds?: string[] }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const project = useStore((s) => projectId ? s.projects.find((p) => p.id === projectId) : undefined);
  const people = usePeople();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#d4a574");
  const [category, setCategory] = useState<string>("");
  const [customCat, setCustomCat] = useState("");
  const me = useSyncExternalStore(subscribeAuth, () => authState().user);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Re-sync on open change
  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setColor(project?.color ?? "#d4a574");
      setCategory(project?.category ?? "");
      setMemberIds(project ? assignedIds(project, me?.id) : []);
    } else {
      setName("");
      setDescription("");
      setColor("#d4a574");
      setCategory("");
      setMemberIds([]);
    }
  }, [open, project, me?.id]);

  const isPreset = !category || (PROJECT_CATEGORY_PRESETS as readonly string[]).includes(category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{projectId ? "Edit Project" : t("projects.new")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">{t("common.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label className="text-xs">{t("common.description")}</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {me?.role === "admin" && (
            <div>
              <Label className="text-xs">{t("projects.members")}</Label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {people.filter((person) => person.id !== me.id).map((person) => {
                  const on = memberIds.includes(person.id);
                  return (
                    <label key={person.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={on}
                        onCheckedChange={(checked) => {
                          setMemberIds(checked ? [...memberIds, person.id] : memberIds.filter((id) => id !== person.id));
                        }}
                      />
                      {person.name}
                    </label>
                  );
                })}
                {people.filter((person) => person.id !== me.id).length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("projects.noMembers")}</p>
                )}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">{t("common.category")}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PROJECT_CATEGORY_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => { setCategory(c); setCustomCat(""); }}
                  className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    category === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  {c}
                </button>
              ))}
              <button type="button" onClick={() => { setCategory(customCat || "custom"); }}
                className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  !isPreset ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                Custom
              </button>
              <button type="button" onClick={() => { setCategory(""); setCustomCat(""); }}
                className={cn("text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  category === "" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {t("common.none")}
              </button>
            </div>
            {!isPreset && (
              <Input className="mt-2" placeholder={t("projects.customCategory")}
                value={customCat || category}
                onChange={(e) => { setCustomCat(e.target.value); setCategory(e.target.value); }} />
            )}
          </div>
          <div><Label className="text-xs">{t("common.color")}</Label>
            <div className="flex gap-2 mt-1">
              {["#d4a574", "#90b890", "#90b8c8", "#c890b8", "#c8a890", "#a8c888"].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-md ${color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer bg-transparent" />
            </div>
          </div>
        </div>
        <DialogFooter>
          {onDelete && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 me-1" />{t("projects.delete")}</Button>}
          {project && (
            <Button
              variant="outline"
              onClick={async () => {
                await useStore.getState().upsertProject({ id: project.id, archived: !project.archived });
                onOpenChange(false);
              }}
            >
              {project.archived ? t("common.unarchive") : t("common.archive")}
            </Button>
          )}
          <Button variant="outline" onClick={() => { onOpenChange(false); setName(""); }}>{t("common.cancel")}</Button>
          <Button onClick={async () => { await onSubmit({ name, description, color, category: category || undefined, memberIds: me?.role === "admin" ? memberIds : undefined }); setName(""); setCategory(""); setCustomCat(""); setMemberIds([]); }}>
            {projectId ? t("common.save") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
