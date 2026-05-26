import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export function ClarityStars({
  value,
  onChange,
  size = "sm",
}: {
  value: number;
  onChange?: (v: 1 | 2 | 3 | 4 | 5) => void;
  size?: "sm" | "md";
}) {
  const s = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={cn(
            "transition-colors",
            onChange ? "cursor-pointer hover:scale-110" : "cursor-default",
          )}
        >
          <Star
            className={cn(
              s,
              n <= value
                ? "fill-warning text-warning"
                : "text-muted-foreground/30",
            )}
          />
        </button>
      ))}
    </div>
  );
}
