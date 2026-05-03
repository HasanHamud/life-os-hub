import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { projectProgress, fmt } from "@/core/utils";
import { TaskRow } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { Plus, FolderKanban, Trash2 } from "lucide-react";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [
    { title: "Projects — Life OS" },
    { name: "description", content: "Group tasks under projects, track progress and feature breakdown." },
  ]}),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, tasks, upsertProject, deleteProject } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [createTaskFor, setCreateTaskFor] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const open = openProject ? projects.find((p) => p.id === openProject) : null;
  const openTasks = open ? tasks.filter((t) => t.projectId === open.id && !t.parentTaskId) : [];
  const visibleProjects = projects.filter((p) => (showArchived ? p.archived : !p.archived));

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Initiatives that group related tasks. Each shows progress and a task tree."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? "Active" : "Archived"}
            </Button>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
          </div>
        }
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProjects.map((p) => {
          const pct = projectProgress(p.id, tasks);
          const total = tasks.filter((t) => t.projectId === p.id).length;
          const done = tasks.filter((t) => t.projectId === p.id && t.status === "done").length;
          return (
            <div key={p.id}
              onClick={() => setOpenProject(p.id)}
              className="rounded-xl border bg-card p-5 cursor-pointer hover:border-primary/40 transition-all hover:shadow-soft">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg grid place-items-center" style={{ backgroundColor: `${p.color}25`, color: p.color }}>
                  <FolderKanban className="h-5 w-5" />
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(p.id); }}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
              </div>
              <div className="text-base font-semibold mb-1">{p.name}</div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span>{done} / {total} tasks</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-3">Created {fmt.date(p.createdAt)}</div>
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
          await upsertProject({ id: editing ?? undefined, ...data });
          setCreating(false); setEditing(null);
        }}
        onDelete={editing ? async () => { await deleteProject(editing); setEditing(null); } : undefined}
      />

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenProject(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: open.color }} />
                  {open.name}
                </DialogTitle>
              </DialogHeader>
              {open.description && <p className="text-sm text-muted-foreground">{open.description}</p>}
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">{openTasks.filter((t) => t.status === "done").length} of {openTasks.length} complete</span>
                <Button size="sm" variant="outline" onClick={() => setCreateTaskFor(open.id)}>+ Task</Button>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div className="h-full" style={{ width: `${projectProgress(open.id, tasks)}%`, backgroundColor: open.color }} />
              </div>
              <div className="space-y-1">
                {openTasks.length === 0 && <div className="text-center text-xs text-muted-foreground py-6">No tasks yet.</div>}
                {openTasks.map((t) => (
                  <div key={t.id}>
                    <TaskRow task={t} onClick={() => setEditTaskId(t.id)} />
                    {tasks.filter((c) => c.parentTaskId === t.id).map((c) => (
                      <div key={c.id} className="ml-7"><TaskRow task={c} onClick={() => setEditTaskId(c.id)} /></div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {createTaskFor && (
        <TaskDialog open={!!createTaskFor} onOpenChange={(v) => !v && setCreateTaskFor(null)}
          taskId={null} />
      )}
      <TaskDialog open={!!editTaskId} onOpenChange={(v) => !v && setEditTaskId(null)} taskId={editTaskId} />
    </PageContainer>
  );
}

function ProjectDialog({
  open, onOpenChange, projectId, onSubmit, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; projectId: string | null;
  onSubmit: (d: { name: string; description?: string; color?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const project = useStore((s) => projectId ? s.projects.find((p) => p.id === projectId) : undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#d4a574");

  useState(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setColor(project?.color ?? "#d4a574");
    }
  });

  // Re-sync on open change
  if (open && project && name === "" && project.name) {
    setName(project.name);
    setDescription(project.description ?? "");
    setColor(project.color ?? "#d4a574");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{projectId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label className="text-xs">Color</Label>
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
          {onDelete && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}
          <Button variant="outline" onClick={() => { onOpenChange(false); setName(""); }}>Cancel</Button>
          <Button onClick={async () => { await onSubmit({ name, description, color }); setName(""); }}>
            {projectId ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
