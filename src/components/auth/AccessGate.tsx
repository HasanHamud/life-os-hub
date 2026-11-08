import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { fetchAuth, markSignedIn, setAuthUser, submitAuth } from "@/core/session";
import { translateError } from "@/core/locale";

type Mode = "loading" | "setup" | "login" | "app";

export function AccessGate() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuth()
      .then((status) => {
        if (status.user) {
          setAuthUser(status.user);
          markSignedIn(true);
          setMode("app");
          return;
        }
        markSignedIn(false);
        setMode(status.needsSetup ? "setup" : "login");
      })
      .catch((err) => {
        setError(translateError(err.message || "The server is not responding"));
        setMode("login");
      });
  }, []);

  if (mode === "loading") {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{t("auth.loading")}</div>;
  }
  if (mode === "app") return <AppShell />;
  return (
    <AuthCard
      mode={mode}
      error={error}
      onError={setError}
      onSuccess={() => setMode("app")}
    />
  );
}

function AuthCard({
  mode,
  error,
  onError,
  onSuccess,
}: {
  mode: "setup" | "login";
  error: string;
  onError: (error: string) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  const setup = mode === "setup";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError("");
    try {
      await submitAuth(setup ? "/api/auth/setup" : "/api/auth/login", {
        name: setup ? name : undefined,
        email,
        password,
      });
      onSuccess();
    } catch (err) {
      onError(translateError(err instanceof Error ? err.message : "Sign in failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 text-card-foreground">
        <div>
          <h1 className="font-display text-2xl font-semibold">{setup ? t("auth.createAdmin") : t("auth.signIn")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {setup ? t("auth.setupHelp") : t("auth.loginHelp")}
          </p>
        </div>
        {setup && (
          <div className="space-y-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">{t("common.email")}</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("common.password")}</Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("common.saving") : setup ? t("auth.createAdminBtn") : t("auth.signIn")}
        </Button>
      </form>
    </div>
  );
}
