import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Problem } from "@/core/learn-types";

const DIFFICULTIES = [
  { value: "1", label: "1 — Very Easy" },
  { value: "2", label: "2 — Easy" },
  { value: "3", label: "3 — Medium" },
  { value: "4", label: "4 — Hard" },
  { value: "5", label: "5 — Very Hard" },
];

const PATTERNS = [
  "two-pointer", "sliding-window", "prefix-sum", "binary-search",
  "hash-map", "stack", "queue", "bfs", "dfs", "dp", "greedy",
  "sorting", "recursion", "backtracking", "math", "string",
];

export function ProblemForm({
  open,
  onOpenChange,
  problem,
  subjects,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  problem?: Problem;
  subjects: string[];
  onSubmit: (data: Partial<Problem> & { title: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState("");
  const [difficulty, setDifficulty] = useState("1");
  const [patternClass, setPatternClass] = useState("");
  const [timeToSolve, setTimeToSolve] = useState("");
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(problem?.title ?? "");
    setSubject(problem?.subject ?? "");
    setSource(problem?.source ?? "");
    setDifficulty(String(problem?.difficulty ?? 1));
    setPatternClass(problem?.patternClass ?? "");
    setTimeToSolve(problem?.timeToSolve ? String(problem.timeToSolve) : "");
    setNotes(problem?.notes ?? "");
    setCompleted(problem?.completed ?? false);
  }, [open, problem]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onSubmit({
      id: problem?.id,
      title: title.trim(),
      subject: subject.trim(),
      source: source.trim(),
      difficulty: Number(difficulty) as 1 | 2 | 3 | 4 | 5,
      patternClass: patternClass.trim(),
      timeToSolve: timeToSolve ? Number(timeToSolve) : undefined,
      notes: notes.trim(),
      completed,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{problem ? "Edit Problem" : "New Problem"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input placeholder="e.g. Two Sum II" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. CP, Math"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="prob-subjects"
              />
              <datalist id="prob-subjects">
                {subjects.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Source</Label>
              <Input placeholder="LeetCode 167" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Pattern Class</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="two-pointer"
                  value={patternClass}
                  onChange={(e) => setPatternClass(e.target.value)}
                  list="patterns-list"
                />
                <datalist id="patterns-list">
                  {PATTERNS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Time to solve (min)</Label>
              <Input type="number" min={0} placeholder="e.g. 15" value={timeToSolve} onChange={(e) => setTimeToSolve(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="prob-completed" checked={completed} onCheckedChange={(v) => setCompleted(!!v)} />
            <label htmlFor="prob-completed" className="text-xs cursor-pointer">Completed</label>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {problem ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
