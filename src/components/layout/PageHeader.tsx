import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions, className,
}: { title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 md:px-10 py-8 max-w-7xl mx-auto w-full", className)}>{children}</div>;
}
