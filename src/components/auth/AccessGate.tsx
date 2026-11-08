import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { fetchAuth, markSignedIn, setAuthUser, submitAuth } from "@/core/session";
import { applyLocale, currentLocale, rememberLocale, rememberedLocale, translateError, type LocaleId } from "@/core/locale";
import { applyTheme, DEFAULT_THEME, rememberTheme, rememberedTheme, THEMES, type ThemeId } from "@/core/theme";
import { getOne, putOne } from "@/core/db";
import { DEFAULT_SETTINGS } from "@/core/store";
import type { Settings } from "@/core/types";
import { cn } from "@/lib/utils";

type Mode = "loading" | "setup" | "login" | "app";

export function AccessGate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState("");
  const enterApp = () => {
    void navigate({ to: "/", replace: true }).finally(() => setMode("app"));
  };

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
  if (mode === "login") {
    return (
      <LoginPage
        error={error}
        onError={setError}
        onSuccess={enterApp}
      />
    );
  }
  return (
    <AuthCard
      mode={mode}
      error={error}
      onError={setError}
      onSuccess={enterApp}
    />
  );
}

const THEME_NAME: Record<ThemeId, string> = {
  "warm-dark": "themes.warmDark",
  "main-light": "themes.mainLight",
  forest: "themes.forest",
  midnight: "themes.midnight",
};

function LoginPage({
  error,
  onError,
  onSuccess,
}: {
  error: string;
  onError: (error: string) => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => rememberedTheme() ?? DEFAULT_THEME);
  const [locale, setLocale] = useState<LocaleId>(() => rememberedLocale() ?? currentLocale());

  useEffect(() => {
    applyTheme(rememberedTheme() ?? DEFAULT_THEME);
    void applyLocale(rememberedLocale() ?? currentLocale());
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError("");
    try {
      await submitAuth("/api/auth/login", { email, password });
      const existing = await getOne<Settings>("settings", "global");
      await putOne("settings", existing ? { ...existing, theme } : { ...DEFAULT_SETTINGS, theme });
      onSuccess();
    } catch (err) {
      onError(translateError(err instanceof Error ? err.message : "Sign in failed"));
    } finally {
      setBusy(false);
    }
  }

  function chooseTheme(id: ThemeId) {
    setTheme(applyTheme(id));
    rememberTheme(id);
  }

  function chooseLocale(id: LocaleId) {
    setLocale(id);
    rememberLocale(id);
    void applyLocale(id);
  }

  const lead = t("brand.tagline");
  const headline = `${lead.charAt(0).toUpperCase()}${lead.slice(1)}.`;

  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2.5 px-6 pt-6 sm:px-10">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{t("brand.mark")}</span>
        <span className="text-sm font-medium">{t("brand.lifeOs")}</span>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div>
          <h1
            className={cn(
              "max-w-[11ch] text-[clamp(3.25rem,6.2vw,5.25rem)] font-medium leading-[0.95] tracking-[-0.03em]",
              locale !== "ar" && "login-serif",
            )}
          >
            {headline}
          </h1>
          <p className="mt-6 max-w-[40ch] text-base text-muted-foreground">{t("auth.private")}</p>
        </div>
        <form onSubmit={submit} className="w-full">
          <div className="border-t-2 border-primary pt-4">
            <h2 className="text-base font-semibold">{t("auth.accountTitle")}</h2>
          </div>
          <div className="mt-6 space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-11 bg-card shadow-none" />
          </div>
          <div className="relative mt-4 space-y-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              className="h-11 bg-card pe-16 shadow-none"
            />
            <button
              type="button"
              className="absolute end-3 bottom-2.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((on) => !on)}
              aria-pressed={showPassword}
            >
              {showPassword ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-6 h-11 w-full shadow-none">{busy ? t("common.saving") : t("auth.signIn")}</Button>
        </form>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4 sm:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label={t("auth.theme")}>
          <span className="text-sm text-muted-foreground">{t("auth.theme")}</span>
          {THEMES.map((item) => {
            const selected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseTheme(item.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  selected ? "font-medium text-foreground underline decoration-2 underline-offset-4" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.swatches[2] }} />
                {t(THEME_NAME[item.id])}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4" role="group" aria-label={t("appBar.language")}>
          {(["en", "ar"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseLocale(id)}
              className={cn(
                "text-sm",
                locale === id ? "font-medium text-foreground underline decoration-2 underline-offset-4" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={locale === id}
            >
              {id === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>
      </footer>
    </main>
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
