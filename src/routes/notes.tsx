import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "@/core/store";
import type { Note, NoteAttachment, NoteStatus, NoteType } from "@/core/types";
import type { Components } from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus, Search, Star, Pin, Trash2, Archive, Code2, FileText, ListChecks,
  Lightbulb, Users, Database, Cloud, ChevronDown, ChevronRight, Save,
  RotateCcw, X, Eye, Edit3, Copy, Maximize2, Paperclip, Filter, Tag as TagIcon,
  FolderKanban, Layers, Sparkles, BookTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Life OS" },
      { name: "description", content: "Capture ideas, write docs, save snippets and organize your thoughts." },
    ],
  }),
  component: NotesPage,
});

const NOTE_TYPES: { value: NoteType; label: string; icon: any }[] = [
  { value: "text", label: "Text Note", icon: FileText },
  { value: "checklist", label: "Checklist", icon: ListChecks },
  { value: "code", label: "Code", icon: Code2 },
  { value: "idea", label: "Quick Idea", icon: Lightbulb },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "doc", label: "Documentation", icon: BookTemplate },
  { value: "sql", label: "SQL", icon: Database },
  { value: "api", label: "API", icon: Cloud },
];

const LANGUAGES = ["javascript", "typescript", "sql", "csharp", "html", "css", "json", "bash", "python"];

const TEMPLATES: { name: string; type: NoteType; title: string; content: string; language?: string }[] = [
  {
    name: "Meeting Notes", type: "meeting", title: "Meeting — ",
    content: `# Meeting Notes\n\n**Date:** ${format(new Date(), "yyyy-MM-dd")}\n**Attendees:** \n\n## Agenda\n- \n\n## Discussion\n- \n\n## Action Items\n- [ ] \n\n## Next Steps\n- `,
  },
  {
    name: "API Documentation", type: "doc", title: "API — ",
    content: `# API Endpoint\n\n**Method:** \`GET\`\n**URL:** \`/api/...\`\n\n## Request\n\`\`\`json\n{}\n\`\`\`\n\n## Response\n\`\`\`json\n{}\n\`\`\`\n\n## Notes\n- `,
  },
  {
    name: "SQL Query Template", type: "sql", title: "SQL — ", language: "sql",
    content: `-- Description: \n-- Author: \n-- Date: ${format(new Date(), "yyyy-MM-dd")}\n\nSELECT *\nFROM table_name\nWHERE 1 = 1;\n`,
  },
  {
    name: "Bug Investigation", type: "doc", title: "Bug — ",
    content: `# Bug Investigation\n\n## Summary\n\n## Steps to Reproduce\n1. \n\n## Expected\n\n## Actual\n\n## Root Cause\n\n## Fix\n`,
  },
  {
    name: "Daily Journal", type: "text", title: `Journal — ${format(new Date(), "yyyy-MM-dd")}`,
    content: `# ${format(new Date(), "EEEE, MMMM d")}\n\n## What went well\n- \n\n## What didn't\n- \n\n## Tomorrow\n- `,
  },
  {
    name: "Feature Planning", type: "doc", title: "Feature — ",
    content: `# Feature\n\n## Problem\n\n## Solution\n\n## Acceptance Criteria\n- [ ] \n\n## Risks\n- `,
  },
];

const CATEGORIES = ["Ideas", "Backend", "Frontend", "SQL", "Auth System", "API", "Security", "Bugs", "Personal"];

function NotesPage() {
  const notes = useStore((s) => s.notes);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const upsertNote = useStore((s) => s.upsertNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const trashNote = useStore((s) => s.trashNote);
  const restoreNote = useStore((s) => s.restoreNote);

  const [view, setView] = useState<"all" | "favorites" | "recent" | "archived" | "trash" | "pinned" | "shared" | "templates">("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const [openSec, setOpenSec] = useState({ views: true, cats: true, tags: true });

  const filtered = useMemo(() => {
    let list = [...notes];
    if (view === "favorites") list = list.filter((n) => n.favorite && n.status !== "trashed");
    else if (view === "archived") list = list.filter((n) => n.status === "archived");
    else if (view === "trash") list = list.filter((n) => n.status === "trashed");
    else if (view === "pinned") list = list.filter((n) => n.pinned && n.status !== "trashed");
    else if (view === "templates") list = list.filter((n) => n.isTemplate);
    else if (view === "recent") list = list.filter((n) => n.status === "active").slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
    else list = list.filter((n) => n.status === "active" && !n.isTemplate);

    if (activeCategory) list = list.filter((n) => n.category === activeCategory);
    if (activeTag) list = list.filter((n) => n.tagIds.includes(activeTag));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.category ?? "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      // pinned first
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [notes, view, activeCategory, activeTag, search, sort]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Auto-select first when none
  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  async function createNote(type: NoteType = "text", extras: Partial<Note> = {}) {
    const n = await upsertNote({
      title: "Untitled",
      content: "",
      type,
      status: "active",
      ...extras,
    });
    setView("all");
    setSelectedId(n.id);
  }

  async function createFromTemplate(t: typeof TEMPLATES[number]) {
    const n = await upsertNote({
      title: t.title,
      content: t.content,
      type: t.type,
      language: t.language,
      status: "active",
    });
    setSelectedId(n.id);
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r bg-sidebar/40 flex flex-col min-h-0">
        <div className="p-3 space-y-2 border-b">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" onClick={() => createNote("text")}>
              <Plus className="h-4 w-4" /> New Note
            </Button>
            <NewNoteMenu onPick={(t) => createNote(t)} onTemplate={createFromTemplate} />
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search everything..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm scrollbar-thin">
          <Collapsible open={openSec.views} onOpenChange={(o) => setOpenSec((s) => ({ ...s, views: o }))}>
            <CollapsibleTrigger className="flex items-center w-full text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1 hover:text-foreground">
              {openSec.views ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              Views
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5">
              <SidebarItem icon={FileText} label="All Notes" active={view === "all"} onClick={() => { setView("all"); setActiveCategory(null); setActiveTag(null); }} count={notes.filter((n) => n.status === "active" && !n.isTemplate).length} />
              <SidebarItem icon={Star} label="Favorites" active={view === "favorites"} onClick={() => setView("favorites")} count={notes.filter((n) => n.favorite && n.status !== "trashed").length} />
              <SidebarItem icon={Pin} label="Pinned" active={view === "pinned"} onClick={() => setView("pinned")} count={notes.filter((n) => n.pinned && n.status !== "trashed").length} />
              <SidebarItem icon={Sparkles} label="Recent" active={view === "recent"} onClick={() => setView("recent")} />
              <SidebarItem icon={BookTemplate} label="Templates" active={view === "templates"} onClick={() => setView("templates")} />
              <SidebarItem icon={Users} label="Shared" active={view === "shared"} onClick={() => setView("shared")} />
              <SidebarItem icon={Archive} label="Archived" active={view === "archived"} onClick={() => setView("archived")} count={notes.filter((n) => n.status === "archived").length} />
              <SidebarItem icon={Trash2} label="Trash" active={view === "trash"} onClick={() => setView("trash")} count={notes.filter((n) => n.status === "trashed").length} />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openSec.cats} onOpenChange={(o) => setOpenSec((s) => ({ ...s, cats: o }))}>
            <CollapsibleTrigger className="flex items-center w-full text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1 mt-2 hover:text-foreground">
              {openSec.cats ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              Categories
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5">
              {CATEGORIES.map((c) => (
                <SidebarItem
                  key={c} icon={Layers} label={c}
                  active={activeCategory === c}
                  onClick={() => setActiveCategory(activeCategory === c ? null : c)}
                  count={notes.filter((n) => n.category === c && n.status === "active").length}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openSec.tags} onOpenChange={(o) => setOpenSec((s) => ({ ...s, tags: o }))}>
            <CollapsibleTrigger className="flex items-center w-full text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1 mt-2 hover:text-foreground">
              {openSec.tags ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
              Tags
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5">
              {tags.length === 0 && <div className="text-xs text-muted-foreground px-2 py-1">No tags yet</div>}
              {tags.map((t) => (
                <SidebarItem
                  key={t.id} icon={TagIcon} label={t.name}
                  active={activeTag === t.id}
                  onClick={() => setActiveTag(activeTag === t.id ? null : t.id)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </aside>

      {/* List */}
      <div className="w-72 shrink-0 border-r flex flex-col min-h-0">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} note{filtered.length !== 1 ? "s" : ""}</span>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Recently updated</SelectItem>
              <SelectItem value="created">Newest</SelectItem>
              <SelectItem value="title">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notes here yet.
            </div>
          )}
          {filtered.map((n) => (
            <NoteRow key={n.id} note={n} active={n.id === selectedId} onClick={() => setSelectedId(n.id)} />
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            projects={projects.filter((p) => !p.archived)}
            tags={tags}
            onChange={(patch) => upsertNote({ ...selected, ...patch })}
            onTrash={async () => {
              await trashNote(selected.id);
              setSelectedId(null);
              toast.success("Moved to trash");
            }}
            onRestore={async () => {
              await restoreNote(selected.id);
              toast.success("Restored");
            }}
            onDelete={async () => {
              await deleteNote(selected.id);
              setSelectedId(null);
              toast.success("Deleted permanently");
            }}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            Select a note or create one to begin.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Sidebar atoms ---------------- */

function SidebarItem({ icon: Icon, label, active, onClick, count }: {
  icon: any; label: string; active?: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-sidebar-accent transition-colors",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function NewNoteMenu({ onPick, onTemplate }: { onPick: (t: NoteType) => void; onTemplate: (t: typeof TEMPLATES[number]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="px-2"><ChevronDown className="h-3 w-3" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create a note</DialogTitle></DialogHeader>
        <Tabs defaultValue="types">
          <TabsList>
            <TabsTrigger value="types">Note Types</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <TabsContent value="types" className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {NOTE_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { onPick(value); setOpen(false); }}
                className="p-3 rounded-md border hover:bg-accent flex flex-col items-center gap-2 text-xs"
              >
                <Icon className="h-5 w-5 text-primary" />
                {label}
              </button>
            ))}
          </TabsContent>
          <TabsContent value="templates" className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => { onTemplate(t); setOpen(false); }}
                className="p-3 rounded-md border hover:bg-accent text-left"
              >
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.type}</div>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Note Row ---------------- */

function NoteRow({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  const TypeIcon = NOTE_TYPES.find((t) => t.value === note.type)?.icon ?? FileText;
  const preview = note.content.replace(/[#*`_>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 border-b hover:bg-accent/50 transition-colors block",
        active && "bg-accent"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{note.title || "Untitled"}</span>
        {note.pinned && <Pin className="h-3 w-3 text-warning shrink-0" />}
        {note.favorite && <Star className="h-3 w-3 text-warning fill-warning shrink-0" />}
      </div>
      <div className="text-xs text-muted-foreground truncate">{preview || "Empty note"}</div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {note.category && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{note.category}</Badge>}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}

/* ---------------- Editor ---------------- */

function NoteEditor({
  note, projects, tags, onChange, onTrash, onRestore, onDelete,
}: {
  note: Note;
  projects: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onChange: (patch: Partial<Note>) => Promise<unknown>;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [savingState, setSavingState] = useState<"saved" | "saving" | "dirty">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number>(note.updatedAt);
  const [mode, setMode] = useState<"edit" | "preview" | "split">("split");
  const [fullscreen, setFullscreen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Re-sync when switching note
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setSavingState("saved");
    setLastSavedAt(note.updatedAt);
  }, [note.id]);

  // Auto-save (debounced)
  useEffect(() => {
    if (title === note.title && content === note.content) return;
    setSavingState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSavingState("saving");
      await onChange({ title, content });
      setSavingState("saved");
      setLastSavedAt(Date.now());
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, content]);

  // Warn on unsaved changes
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (savingState !== "saved") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [savingState]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flushSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault(); wrapSel("**", "**");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault(); wrapSel("*", "*");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setMode((m) => (m === "preview" ? "edit" : "preview"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function flushSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavingState("saving");
    await onChange({ title, content });
    setSavingState("saved");
    setLastSavedAt(Date.now());
  }

  function wrapSel(left: string, right: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = content.slice(start, end);
    const next = content.slice(0, start) + left + sel + right + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + left.length, end + left.length);
    });
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) { setContent(content + text); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  }

  // Slash commands
  function handleContentChange(v: string) {
    setContent(v);
    const ta = taRef.current;
    if (!ta) return;
    // detect /command followed by enter
    const cursor = ta.selectionStart;
    const before = v.slice(0, cursor);
    const m = before.match(/\/(\w+)$/);
    if (!m) return;
    // we let Enter trigger via separate keydown if needed; this simple impl auto-replaces known ones immediately
    const cmd = m[1].toLowerCase();
    const replacements: Record<string, string> = {
      table: "\n| Col 1 | Col 2 |\n| --- | --- |\n|  |  |\n",
      code: "\n```\n\n```\n",
      sql: "\n```sql\nSELECT * FROM table;\n```\n",
      todo: "\n- [ ] ",
      h1: "\n# ",
      h2: "\n## ",
      quote: "\n> ",
      hr: "\n\n---\n\n",
    };
    if (replacements[cmd]) {
      const newContent = v.slice(0, cursor - m[0].length) + replacements[cmd] + v.slice(cursor);
      setContent(newContent);
    }
  }

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newAtt: NoteAttachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: too large (max 5MB)`);
        continue;
      }
      const dataUrl = await readAsDataURL(f);
      newAtt.push({
        id: crypto.randomUUID(), name: f.name, mime: f.type,
        dataUrl, size: f.size, addedAt: Date.now(),
      });
    }
    if (newAtt.length === 0) return;
    const merged = [...(note.attachments ?? []), ...newAtt];
    await onChange({ attachments: merged });
    // For images, also drop a markdown image at the cursor
    for (const a of newAtt) {
      if (a.mime.startsWith("image/")) insertAtCursor(`\n![${a.name}](${a.dataUrl})\n`);
    }
    toast.success(`Added ${newAtt.length} attachment(s)`);
  }

  const isCode = note.type === "code" || note.type === "sql" || note.type === "api";

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", fullscreen && "fixed inset-0 z-50 bg-background")}>
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={note.favorite ? "default" : "ghost"} onClick={() => onChange({ favorite: !note.favorite })}>
          <Star className={cn("h-4 w-4", note.favorite && "fill-current")} />
        </Button>
        <Button size="sm" variant={note.pinned ? "default" : "ghost"} onClick={() => onChange({ pinned: !note.pinned })}>
          <Pin className="h-4 w-4" />
        </Button>

        <Select value={note.type} onValueChange={(v) => onChange({ type: v as NoteType })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NOTE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={note.category ?? "_none"} onValueChange={(v) => onChange({ category: v === "_none" ? undefined : v })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No category</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={note.priority ?? "_none"} onValueChange={(v) => onChange({ priority: v === "_none" ? undefined : (v as any) })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">—</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="med">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={note.projectId ?? "_none"} onValueChange={(v) => onChange({ projectId: v === "_none" ? undefined : v })}>
          <SelectTrigger className="h-8 w-32 text-xs"><FolderKanban className="h-3 w-3 mr-1" /><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No project</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {isCode && (
          <Select value={note.language ?? "javascript"} onValueChange={(v) => onChange({ language: v })}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-1">
          <SaveIndicator state={savingState} lastSavedAt={lastSavedAt} />
          <div className="border rounded-md flex">
            <Button size="sm" variant={mode === "edit" ? "secondary" : "ghost"} className="h-7 px-2 rounded-r-none" onClick={() => setMode("edit")}><Edit3 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant={mode === "split" ? "secondary" : "ghost"} className="h-7 px-2 rounded-none" onClick={() => setMode("split")}>Split</Button>
            <Button size="sm" variant={mode === "preview" ? "secondary" : "ghost"} className="h-7 px-2 rounded-l-none" onClick={() => setMode("preview")}><Eye className="h-3.5 w-3.5" /></Button>
          </div>
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" onChange={(e) => handleAttach(e.target.files)} />
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent" title="Attach file">
              <Paperclip className="h-4 w-4" />
            </span>
          </label>
          <Button size="sm" variant="ghost" onClick={() => setFullscreen(!fullscreen)} title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
          {note.status === "active" && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ status: "archived" })} title="Archive"><Archive className="h-4 w-4" /></Button>
          )}
          {note.status === "archived" && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ status: "active" })} title="Unarchive"><RotateCcw className="h-4 w-4" /></Button>
          )}
          {note.status !== "trashed" ? (
            <Button size="sm" variant="ghost" onClick={onTrash} title="Move to trash"><Trash2 className="h-4 w-4" /></Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={onRestore} title="Restore"><RotateCcw className="h-4 w-4" /></Button>
              <Button size="sm" variant="destructive" onClick={onDelete} title="Delete forever"><X className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pt-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="text-2xl font-semibold border-0 px-0 focus-visible:ring-0 shadow-none h-auto"
        />
        {/* Tag chips */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {(note.tagIds ?? []).map((tid) => {
            const t = tags.find((x) => x.id === tid);
            if (!t) return undefined;
            return (
              <Badge key={tid} variant="secondary" className="text-[10px] gap-1">
                {t.name}
                <button onClick={() => onChange({ tagIds: note.tagIds.filter((x) => x !== tid) })}><X className="h-2.5 w-2.5" /></button>
              </Badge>
            );
          })}
          <Select value="" onValueChange={(v) => { if (v && !note.tagIds.includes(v)) onChange({ tagIds: [...note.tagIds, v] }); }}>
            <SelectTrigger className="h-6 text-[10px] w-24 border-dashed"><span>+ Tag</span></SelectTrigger>
            <SelectContent>
              {tags.filter((t) => !note.tagIds.includes(t.id)).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <div className={cn("h-full grid gap-4 min-h-0", mode === "split" ? "grid-cols-2" : "grid-cols-1")}>
          {(mode === "edit" || mode === "split") && (
            <div className={cn("min-h-0 flex flex-col", isCode && "rounded-md border bg-muted/30")}>
              <Textarea
                ref={taRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onDrop={(e) => { e.preventDefault(); handleAttach(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
                placeholder={
                  isCode
                    ? "// Write your code here\n// Tip: use the Preview to see syntax highlighting"
                    : "Start writing... use markdown.\n\nSlash commands: /table /code /sql /todo /h1 /h2 /quote /hr\nShortcuts: Cmd/Ctrl+B bold · +I italic · +S save · +Shift+P preview"
                }
                className={cn(
                  "flex-1 resize-none border-0 focus-visible:ring-0 shadow-none text-sm leading-relaxed",
                  isCode && "font-mono bg-transparent"
                )}
              />
            </div>
          )}
          {(mode === "preview" || mode === "split") && (
            <div className="min-h-0 overflow-y-auto rounded-md border p-4 prose prose-sm dark:prose-invert max-w-none">
              {isCode ? (
                <CodeBlock code={content} language={note.language ?? "javascript"} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {content || "*Nothing to preview yet.*"}
                </ReactMarkdown>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachments */}
      {note.attachments && note.attachments.length > 0 && (
        <div className="border-t px-4 py-2 flex gap-2 flex-wrap">
          {note.attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 border rounded px-2 py-1 text-xs">
              {a.mime.startsWith("image/") ? (
                <img src={a.dataUrl} alt={a.name} className="h-6 w-6 object-cover rounded" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              <a href={a.dataUrl} download={a.name} className="hover:underline">{a.name}</a>
              <button
                onClick={() => onChange({ attachments: (note.attachments ?? []).filter((x) => x.id !== a.id) })}
                className="text-muted-foreground hover:text-foreground"
              ><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Footer status */}
      <div className="border-t px-4 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Created {format(note.createdAt, "PPp")}</span>
        <span>Updated {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function SaveIndicator({ state, lastSavedAt }: { state: "saved" | "saving" | "dirty"; lastSavedAt: number }) {
  return (
    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mr-2">
      <Save className="h-3 w-3" />
      {state === "saving" && <span>Saving…</span>}
      {state === "dirty" && <span>Unsaved</span>}
      {state === "saved" && <span>Saved · {format(lastSavedAt, "HH:mm:ss")}</span>}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }
  const lines = code.split("\n");
  return (
    <div className="not-prose rounded-md border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b text-xs">
        <span className="font-mono text-muted-foreground">{language}</span>
        <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={copy}>
          <Copy className="h-3 w-3" />{copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto text-xs leading-5 p-0 m-0">
        <table className="font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="select-none text-right pr-3 pl-2 text-muted-foreground/60 align-top w-10">{i + 1}</td>
                <td className="whitespace-pre pr-4">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </pre>
    </div>
  );
}

const mdComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    const isInline = !("node" in props && (props as any).node?.type === "code");
    if (!isInline && match) {
      return <CodeBlock code={code} language={match[1]} />;
    }
    return <code className={cn("bg-muted px-1 py-0.5 rounded text-[0.85em]", className)} {...(props as ComponentPropsWithoutRef<"code">)}>{children}</code>;
  },
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}