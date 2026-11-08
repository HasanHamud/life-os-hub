import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_others")({
  component: OthersLayout,
});

function OthersLayout() {
  return <Outlet />;
}
