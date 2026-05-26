import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LearnTabs } from "@/components/learn/LearnTabs";

export const Route = createFileRoute("/learn")({
  component: LearnLayout,
});

function LearnLayout() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <LearnTabs />
      <Outlet />
    </div>
  );
}
