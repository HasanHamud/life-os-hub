import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useStore } from "@/core/store";
import { subscribeAuth, viewUserId } from "@/core/session";

export const Route = createFileRoute("/finance")({
  component: FinanceLayout,
});

function FinanceLayout() {
  const loaded = useStore((s) => s.loaded);
  const financeEnabled = useStore((s) => s.settings.financeEnabled);
  const viewingOther = useSyncExternalStore(subscribeAuth, () => !!viewUserId());
  if (viewingOther || (loaded && !financeEnabled)) return <Navigate to="/" />;
  return <Outlet />;
}
