import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useRef } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startOfWeek, addWeeks, addDays, format, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { WeeklyIntention } from "@/components/schedule/WeeklyIntention";
import { DEFAULT_WEEK_CATEGORIES } from "@/core/types";
import { toast } from "sonner";

export const Route = createFileRoute("/weekly-plan")({
  head: () => ({
    meta: [
      { title: "Weekly Plan — Life OS" },
      { name: "description", content: "Plan your week across all categories." },
    ],
  }),
  component: WeeklyPlanPage,
});

const PALETTE = [
  "bg-amber-500/20 text-amber-700",
  "bg-sky-500/20 text-sky-700",
  "bg-emerald-500/20 text-emerald-700",
  "bg-violet-500/20 text-violet-700",
  "bg-orange-500/20 text-orange-700",
  "bg-rose-500/20 text-rose-700",
  "bg-cyan-500/20 text-cyan-700",
  "bg-lime-500/20 text-lime-700",
  "bg-fuchsia-500/20 text-fuchsia-700",
  "bg-teal-500/20 text-teal-700",
];

function cellId(day: Date, catIdx: number) {
  return `${format(day, "yyyy-MM-dd")}_${catIdx}`;
}

function WeeklyPlanPage() {
  const { weeklyPlans, upsertWeeklyPlan } = useStore();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const today = startOfDay(new Date());
  const [anchor, setAnchor] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  const weekId = `week-${format(anchor, "yyyy-MM-dd")}`;
  const weekPlan = weeklyPlans.find((p) => p.id === weekId);

  const categories = weekPlan?.categories ?? DEFAULT_WEEK_CATEGORIES;

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);

  const goPrev = () => setAnchor(addWeeks(anchor, -1));
  const goNext = () => setAnchor(addWeeks(anchor, 1));
  const goThisWeek = () => setAnchor(startOfWeek(today, { weekStartsOn: 1 }));

  const getNote = useCallback(
    (day: Date, catIdx: number): string => {
      return weekPlan?.categoryNotes?.[cellId(day, catIdx)] ?? "";
    },
    [weekPlan],
  );

  const setNote = useCallback(
    async (day: Date, catIdx: number, value: string) => {
      const key = cellId(day, catIdx);
      const existing = weeklyPlans.find((p) => p.id === weekId);
      const notes = { ...(existing?.categoryNotes ?? {}), [key]: value };
      Object.keys(notes).forEach((k) => {
        if (!notes[k]) delete notes[k];
      });
      await upsertWeeklyPlan({
        id: weekId,
        weekStart: anchor.getTime(),
        categories: existing?.categories,
        categoryNotes: notes as Record<string, string>,
        intention: existing?.intention ?? "",
        goals: existing?.goals ?? [],
        notes: existing?.notes ?? "",
      });
    },
    [weekId, anchor, weeklyPlans, upsertWeeklyPlan],
  );

  const updateGeneralNotes = useCallback(async () => {
    const val = notesRef.current?.value ?? "";
    const existing = weeklyPlans.find((p) => p.id === weekId);
    await upsertWeeklyPlan({
      id: weekId,
      weekStart: anchor.getTime(),
      categories: existing?.categories,
      categoryNotes: existing?.categoryNotes ?? {},
      intention: existing?.intention ?? "",
      goals: existing?.goals ?? [],
      notes: val,
    });
  }, [weekId, anchor, weeklyPlans, upsertWeeklyPlan]);

  const addCategory = useCallback(async () => {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    const existing = weeklyPlans.find((p) => p.id === weekId);
    await upsertWeeklyPlan({
      id: weekId,
      weekStart: anchor.getTime(),
      categories: [...categories, name],
      categoryNotes: existing?.categoryNotes ?? {},
      intention: existing?.intention ?? "",
      goals: existing?.goals ?? [],
      notes: existing?.notes ?? "",
    });
    setNewCat("");
    setAdding(false);
    toast.success(`Added "${name}"`);
  }, [newCat, categories, weekId, anchor, weeklyPlans, upsertWeeklyPlan]);

  const removeCategory = useCallback(
    async (idx: number) => {
      const name = categories[idx];
      const existing = weeklyPlans.find((p) => p.id === weekId);
      const newCats = categories.filter((_, i) => i !== idx);
      const notes = { ...(existing?.categoryNotes ?? {}) };
      // remove cells for this category
      for (const day of weekDays) {
        delete notes[cellId(day, idx)];
      }
      // shift remaining cells down (since indices changed)
      const shifted: Record<string, string> = {};
      for (const day of weekDays) {
        for (let i = idx; i < newCats.length; i++) {
          const oldKey = cellId(day, i + 1);
          if (notes[oldKey]) {
            shifted[cellId(day, i)] = notes[oldKey];
            delete notes[oldKey];
          }
        }
      }
      const merged = { ...notes, ...shifted };
      await upsertWeeklyPlan({
        id: weekId,
        weekStart: anchor.getTime(),
        categories: newCats,
        categoryNotes: merged,
        intention: existing?.intention ?? "",
        goals: existing?.goals ?? [],
        notes: existing?.notes ?? "",
      });
      toast.success(`Removed "${name}"`);
    },
    [categories, weekId, anchor, weekDays, weeklyPlans, upsertWeeklyPlan],
  );

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Weekly Plan"
        description="Plan your week. Write notes for each category per day."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={goThisWeek}>
              This Week
            </Button>
            <Button size="sm" variant="ghost" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <WeeklyIntention
        weekStart={anchor.getTime()}
        plan={weekPlan}
        onSave={async (intention, goals) => {
          await upsertWeeklyPlan({
            id: weekId,
            weekStart: anchor.getTime(),
            intention,
            goals,
            categories: weekPlan?.categories ?? categories,
            categoryNotes: weekPlan?.categoryNotes ?? {},
            notes: weekPlan?.notes ?? "",
          });
        }}
      />

      <div className="rounded-xl border bg-card overflow-hidden mb-4">
        <div className="grid grid-cols-[100px_repeat(7,1fr)_40px]">
          <div className="px-3 py-2.5 border-b border-r text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Category
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="px-3 py-2.5 border-b border-r last:border-r-0 text-center"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {format(day, "EEE")}
                {day.getDay() === 0 && <span className="ml-1 text-[8px] text-warning">Plan</span>}
              </div>
              <div className="text-sm font-medium">{format(day, "d")}</div>
            </div>
          ))}
          <div className="border-b" />
        </div>

        {categories.map((name, idx) => (
          <div key={idx} className="grid grid-cols-[100px_repeat(7,1fr)_40px] border-t">
            <div
              className={`px-3 py-3 border-r text-xs font-semibold flex items-center ${PALETTE[idx % PALETTE.length]}`}
            >
              {name}
            </div>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="border-r last:border-r-0">
                <textarea
                  className="w-full h-24 resize-none bg-transparent px-2 py-1.5 text-xs outline-none focus:bg-accent/30 transition-colors placeholder:text-muted-foreground/30"
                  placeholder="—"
                  value={getNote(day, idx)}
                  onChange={(e) => setNote(day, idx, e.target.value)}
                />
              </div>
            ))}
            <div className="flex items-center justify-center border-l">
              <button
                onClick={() => removeCategory(idx)}
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex items-center gap-2 mb-4">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Category name"
            className="h-8 text-xs max-w-[200px]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") addCategory();
            }}
          />
          <Button size="sm" onClick={addCategory}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setNewCat("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="mb-4">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
        </Button>
      )}

      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Notes / Sticky
        </div>
        <textarea
          ref={notesRef}
          defaultValue={weekPlan?.notes ?? ""}
          onBlur={updateGeneralNotes}
          className="w-full min-h-[80px] resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground/30"
          placeholder="Anything that comes to mind — tasks, reminders, ideas..."
        />
      </div>
    </PageContainer>
  );
}
