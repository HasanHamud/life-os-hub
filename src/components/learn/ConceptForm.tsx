import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ClarityStars } from "./ClarityStars";
import type { Concept } from "@/core/learn-types";

export function ConceptForm({
  open,
  onOpenChange,
  concept,
  subjects,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  concept?: Concept;
  subjects: string[];
  onSubmit: (data: Partial<Concept> & { subject: string; title: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState("1");
  const [clarity, setClarity] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [canExplain, setCanExplain] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubject(concept?.subject ?? "");
    setTopic(concept?.topic ?? "");
    setTitle(concept?.title ?? "");
    setPhase(String(concept?.phase ?? 1));
    setClarity(concept?.clarityRating ?? 1);
    setCanExplain(concept?.canExplainWithoutNotes ?? false);
    setNotes(concept?.notes ?? "");
  }, [open, concept]);

  const handleSubmit = async () => {
    if (!subject.trim() || !title.trim()) return;
    await onSubmit({
      id: concept?.id,
      subject: subject.trim(),
      topic: topic.trim(),
      title: title.trim(),
      phase: Number(phase) || 1,
      clarityRating: clarity,
      canExplainWithoutNotes: canExplain,
      notes: notes.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{concept ? "Edit Concept" : "New Concept"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Math, Physics, CP"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="concept-subjects"
              />
              <datalist id="concept-subjects">
                {subjects.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div>
            <Label className="text-xs">Topic</Label>
            <Input placeholder="e.g. Functions" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input placeholder="e.g. Domain & Range" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Phase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>Phase {n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Clarity</Label>
              <div className="pt-1.5">
                <ClarityStars value={clarity} onChange={setClarity} size="md" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="can-explain" checked={canExplain} onCheckedChange={(v) => setCanExplain(!!v)} />
            <label htmlFor="can-explain" className="text-xs cursor-pointer">Can explain without notes</label>
          </div>
          <div>
            <Label className="text-xs">Notes (markdown)</Label>
            <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!subject.trim() || !title.trim()}>
            {concept ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
