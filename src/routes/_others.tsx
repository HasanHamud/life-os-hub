import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OthersTabs } from "@/components/layout/OthersTabs";

export const Route = createFileRoute("/_others")({
  component: OthersLayout,
});

function OthersLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <OthersTabs />
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
