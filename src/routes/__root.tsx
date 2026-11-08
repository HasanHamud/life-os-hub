import { createRootRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AccessGate } from "@/components/auth/AccessGate";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.body")}</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{t("notFound.home")}</a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: AccessGate,
  notFoundComponent: NotFoundComponent,
});
