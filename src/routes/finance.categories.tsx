import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Category, CategoryType } from "@/core/finance-types";
import { categoryPath } from "@/core/finance-utils";

export const Route = createFileRoute("/finance/categories")({
  head: () => ({ meta: [{ title: "Categories — Finance" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { categories, upsertCategory, deleteCategory } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [tab, setTab] = useState<CategoryType>("expense");

  const filtered = categories.filter((c) => c.type === tab);
  const roots = filtered.filter((c) => !c.parentCategoryId);
  const childrenOf = (id: string) => filtered.filter((c) => c.parentCategoryId === id);

  return (
    <PageContainer>
      <PageHeader
        title="Categories"
        description="Hierarchical categories with color coding."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add category</Button>}
      />

      <div className="inline-flex rounded-md border bg-card p-1 mb-4">
        {(["expense", "income"] as CategoryType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded font-medium capitalize transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >{t}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {roots.map((root) => (
          <div key={root.id} className="rounded-xl border bg-card p-3">
            <CategoryRow c={root} onEdit={(c) => { setEditing(c); setOpen(true); }} />
            <div className="mt-1 ml-3 border-l border-border/50 pl-3 space-y-1">
              {childrenOf(root.id).map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={(c) => { setEditing(c); setOpen(true); }} small />
              ))}
            </div>
          </div>
        ))}
      </div>

      <CategoryDialog
        open={open}
        onOpenChange={setOpen}
        category={editing}
        defaultType={tab}
        onUpsert={upsertCategory}
        onDelete={deleteCategory}
        categories={categories}
        onClose={() => setOpen(false)}
      />
    </PageContainer>
  );
}

function CategoryRow({ c, onEdit, small }: { c: Category; onEdit: (c: Category) => void; small?: boolean }) {
  return (
    <div className="flex items-center gap-2 group">
      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.color }} />
      <span className={small ? "text-xs flex-1 truncate" : "text-sm font-medium flex-1 truncate"}>{c.name}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onEdit(c)}>
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}

function CategoryDialog({
  open, onOpenChange, category, defaultType, onUpsert, onDelete, categories, onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  defaultType: CategoryType;
  onUpsert: (c: Partial<Category> & { name?: string; type?: CategoryType }) => Promise<Category>;
  onDelete: (id: string) => Promise<void>;
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [parent, setParent] = useState<string>("none");
  const [color, setColor] = useState("#d4a574");

  if (open && category && name === "" && category.name !== "") {
    setName(category.name);
    setType(category.type);
    setParent(category.parentCategoryId ?? "none");
    setColor(category.color);
  }
  if (open && !category && name === "" && type !== defaultType) {
    setType(defaultType);
  }

  const reset = () => { setName(""); setType(defaultType); setParent("none"); setColor("#d4a574"); };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    const isNew = !category;
    await onUpsert({
      id: category?.id,
      name: name.trim(),
      type,
      parentCategoryId: parent === "none" ? undefined : parent,
      color,
    });
    toast.success(isNew ? "Category added" : "Category updated");
    reset(); onClose();
  };

  const remove = async () => {
    if (!category) return;
    if (!confirm(`Delete "${category.name}" and its children?`)) return;
    await onDelete(category.id);
    toast.success("Category deleted");
    reset(); onClose();
  };

  const possibleParents = categories.filter(
    (c) => c.type === type && c.id !== category?.id && !c.parentCategoryId
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as CategoryType); setParent("none"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Parent (optional)</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (top-level) —</SelectItem>
                {possibleParents.map((c) => <SelectItem key={c.id} value={c.id}>{categoryPath(c, categories)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          {category && (
            <Button variant="ghost" onClick={remove} className="mr-auto text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}>{category ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
