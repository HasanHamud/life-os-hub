import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

export const Route = createFileRoute("/tags")({
  head: () => ({ meta: [
    { title: i18n.t("meta.tags") },
    { name: "description", content: "Manage tags to categorize tasks and filter across the app." },
  ]}),
  component: TagsPage,
});

function TagsPage() {
  const { t } = useTranslation();
  const { tags, tasks, sessions, upsertTag, deleteTag } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title={t("tags.title")}
        description="Cross-cutting labels. Assign multiple tags to tasks and filter anywhere."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 me-1" />{t("tags.new")}</Button>}
      />

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {tags.map((tag) => {
          const taskCount = tasks.filter((x) => x.tagIds.includes(tag.id)).length;
          const minutes = Math.round(sessions
            .filter((s) => s.taskId && tasks.find((tk) => tk.id === s.taskId)?.tagIds.includes(tag.id))
            .reduce((a, s) => a + s.duration / 60, 0));
          return (
            <button key={tag.id} onClick={() => setEditing(tag.id)}
              className="rounded-xl border bg-card p-4 text-start hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: tag.color }} />
                <span className="font-medium">#{tag.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">{taskCount} tasks · {t("time.min", { count: minutes })} focus</div>
            </button>
          );
        })}
        {tags.length === 0 && <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("notes.noTags")}</div>}
      </div>

      <TagDialog open={creating || !!editing} tagId={editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        onSubmit={async (d) => { await upsertTag({ id: editing ?? undefined, ...d }); setCreating(false); setEditing(null); }}
        onDelete={editing ? async () => { await deleteTag(editing); setEditing(null); } : undefined}
      />
    </PageContainer>
  );
}

function TagDialog({
  open, onOpenChange, tagId, onSubmit, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; tagId: string | null;
  onSubmit: (d: { name: string; color: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const tag = useStore((s) => tagId ? s.tags.find((item) => item.id === tagId) : undefined);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#d4a574");

  // sync on open
  useEffect(() => {
    if (open && tag) {
      setName(tag.name);
      setColor(tag.color);
    } else if (!open) {
      setName("");
      setColor("#d4a574");
    }
  }, [open, tag]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setName(""); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tagId ? "Edit Tag" : t("tags.new")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">{t("common.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value.replace(/\s+/g, "-").toLowerCase())} autoFocus /></div>
          <div><Label className="text-xs">{t("common.color")}</Label>
            <div className="flex gap-2 mt-1">
              {["#d4a574", "#90b890", "#90b8c8", "#c890b8", "#c8a890", "#a8c888", "#e0a85c"].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-md ${color === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded cursor-pointer bg-transparent" />
            </div>
          </div>
        </div>
        <DialogFooter>
          {onDelete && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 me-1" />{t("common.delete")}</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={async () => { await onSubmit({ name, color }); setName(""); }}>{tagId ? t("common.save") : t("tags.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
