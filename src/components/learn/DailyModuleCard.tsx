import { useLearnStore } from "@/core/learn-store";
import { Button } from "@/components/ui/button";
import { GraduationCap, SkipForward, Settings2 } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function DailyModuleCard({
  onStartSession,
  onConfigure,
}: {
  onStartSession: () => void;
  onConfigure: () => void;
}) {
  const { getDayEntry, upsertRotationEntry } = useLearnStore();
  const today = new Date().getDay();
  const entry = getDayEntry(today);

  if (!entry || !entry.enabled) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/30 text-muted-foreground grid place-items-center text-lg">
              🧘
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {DAY_NAMES[today]}
              </div>
              <div className="text-lg font-semibold text-muted-foreground">No session scheduled</div>
              <div className="text-sm text-muted-foreground">Add or enable a rotation entry</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings2 className="h-4 w-4 mr-1" />
            Configure
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center text-lg">
            {entry.icon}
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {DAY_NAMES[today]}
            </div>
            <div className="text-lg font-semibold">{entry.subject}</div>
            <div className="text-sm text-muted-foreground">{entry.topic}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onConfigure}>
            <Settings2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button onClick={onStartSession} size="sm">
            <GraduationCap className="h-4 w-4 mr-1" />
            Start session
          </Button>
        </div>
      </div>
    </div>
  );
}
