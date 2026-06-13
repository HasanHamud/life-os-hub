import { useState, useEffect, useCallback } from "react";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WeeklyPlan } from "@/core/types";

interface WeeklyIntentionProps {
  weekStart: number;
  plan?: WeeklyPlan;
  onSave: (intention: string, goals: string[]) => Promise<void>;
}

export function WeeklyIntention({ weekStart, plan, onSave }: WeeklyIntentionProps) {
  const [editing, setEditing] = useState(false);
  const [intention, setIntention] = useState(plan?.intention ?? "");
  const [goals, setGoals] = useState<string[]>(plan?.goals ?? []);

  useEffect(() => {
    setIntention(plan?.intention ?? "");
    setGoals(plan?.goals ?? []);
  }, [plan, weekStart]);

  const handleSave = useCallback(async () => {
    await onSave(intention, goals.filter(Boolean));
    setEditing(false);
  }, [intention, goals, onSave]);

  const addGoal = () => setGoals((g) => [...g, ""]);
  const updateGoal = (idx: number, val: string) =>
    setGoals((g) => g.map((x, i) => (i === idx ? val : x)));
  const removeGoal = (idx: number) =>
    setGoals((g) => g.filter((_, i) => i !== idx));

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="rounded-xl border bg-card p-4 mb-4 cursor-pointer group hover:border-primary/40 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {intention ? (
              <p className="text-sm font-medium text-foreground">{intention}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Set your weekly intention…</p>
            )}
            {goals.filter(Boolean).length > 0 && (
              <ul className="mt-2 space-y-1">
                {goals.filter(Boolean).map((g, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 mb-4">
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">
            Weekly Intention
          </label>
          <Input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="What do you want to focus on this week?"
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">
            Goals for this week
          </label>
          <div className="space-y-1.5">
            {goals.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={g}
                  onChange={(e) => updateGoal(i, e.target.value)}
                  placeholder={`Goal ${i + 1}`}
                  className="text-sm"
                />
                <button onClick={() => removeGoal(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={addGoal} className="mt-1.5 h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add goal
          </Button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={handleSave}>
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
