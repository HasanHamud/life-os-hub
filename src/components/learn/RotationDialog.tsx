import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Trash2, Plus } from "lucide-react";
import type { RotationEntry } from "@/core/learn-types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function RotationDialog({
  open,
  onOpenChange,
  rotation,
  onUpsert,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rotation: RotationEntry[];
  onUpsert: (entry: RotationEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [entries, setEntries] = useState<RotationEntry[]>([]);

  useEffect(() => {
    if (open) {
      setEntries([...rotation].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    }
  }, [open, rotation]);

  const update = (idx: number, patch: Partial<RotationEntry>) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const saveAll = async () => {
    for (const entry of entries) {
      await onUpsert(entry);
    }
    onOpenChange(false);
  };

  const addNew = () => {
    const used = new Set(entries.map((e) => e.dayOfWeek));
    let free = -1;
    for (let i = 0; i < 7; i++) {
      if (!used.has(i)) { free = i; break; }
    }
    if (free === -1) return;
    setEntries((prev) => [
      ...prev,
      { id: `day-${free}`, dayOfWeek: free, subject: "", topic: "", icon: "📌", enabled: true },
    ].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Weekly Rotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No rotation entries. Add a day below.
            </div>
          )}
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className={cn(
                "rounded-xl border p-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center",
                !entry.enabled && "opacity-50",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-14 text-right">
                {DAY_NAMES[entry.dayOfWeek].slice(0, 3)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 text-sm w-12"
                    value={entry.icon}
                    onChange={(e) => update(idx, { icon: e.target.value })}
                  />
                  <Input
                    className="h-8 text-sm"
                    placeholder="Subject"
                    value={entry.subject}
                    onChange={(e) => update(idx, { subject: e.target.value })}
                  />
                </div>
                <Input
                  className="h-8 text-sm"
                  placeholder="Topic"
                  value={entry.topic}
                  onChange={(e) => update(idx, { topic: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={entry.enabled}
                  onCheckedChange={(v) => update(idx, { enabled: v })}
                />
                <button
                  onClick={async () => {
                    await onDelete(entry.id);
                    setEntries((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="h-7 w-7 rounded-md hover:bg-destructive/10 grid place-items-center text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {entries.length < 7 && (
            <Button variant="outline" size="sm" onClick={addNew} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add day
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={saveAll}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
