import { cn } from "@/lib/utils";

export function PhaseProgressBar({
  phases,
}: {
  phases: { phase: number; pct: number; label: string }[];
}) {
  return (
    <div className="space-y-3">
      {phases.map(({ phase, pct, label }) => (
        <div key={phase}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">Phase {phase} — {label}</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 80 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
