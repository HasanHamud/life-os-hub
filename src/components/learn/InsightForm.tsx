import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LearningInsight } from "@/core/learn-types";

export function InsightForm({
  open,
  onOpenChange,
  insight,
  subjects,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  insight?: LearningInsight;
  subjects: string[];
  onSubmit: (data: Partial<LearningInsight> & { subject: string; keyIdea: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [keyIdea, setKeyIdea] = useState("");
  const [insight1, setInsight1] = useState("");
  const [insight2, setInsight2] = useState("");
  const [insight3, setInsight3] = useState("");
  const [mistakes, setMistakes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubject(insight?.subject ?? "");
    setTopic(insight?.topic ?? "");
    setKeyIdea(insight?.keyIdea ?? "");
    setInsight1(insight?.insights?.[0] ?? "");
    setInsight2(insight?.insights?.[1] ?? "");
    setInsight3(insight?.insights?.[2] ?? "");
    setMistakes(insight?.mistakes ?? "");
  }, [open, insight]);

  const handleSubmit = async () => {
    if (!subject.trim() || !keyIdea.trim()) return;
    await onSubmit({
      id: insight?.id,
      subject: subject.trim(),
      topic: topic.trim(),
      keyIdea: keyIdea.trim(),
      insights: [insight1.trim(), insight2.trim(), insight3.trim()].filter(Boolean),
      mistakes: mistakes.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{insight ? "Edit Insight" : "New Insight"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Subject</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Math, Physics, CP"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="subjects-list"
              />
              <datalist id="subjects-list">
                {subjects.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div>
            <Label className="text-xs">Topic</Label>
            <Input placeholder="e.g. Functions, Kinematics" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Key Idea</Label>
            <Input placeholder="One-liner summary" value={keyIdea} onChange={(e) => setKeyIdea(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Insights</Label>
            <div className="space-y-1.5">
              <Input placeholder="Insight 1" value={insight1} onChange={(e) => setInsight1(e.target.value)} />
              <Input placeholder="Insight 2" value={insight2} onChange={(e) => setInsight2(e.target.value)} />
              <Input placeholder="Insight 3" value={insight3} onChange={(e) => setInsight3(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mistakes (optional)</Label>
            <Textarea placeholder="What did you get wrong?" rows={2} value={mistakes} onChange={(e) => setMistakes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!subject.trim() || !keyIdea.trim()}>
            {insight ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
