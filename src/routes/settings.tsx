import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useSyncExternalStore } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { exportAll, importAll, clearAll, putOne, getAll, delOne, uid } from "@/core/db";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { applyTheme, isThemeId, THEMES, type ThemeId } from "@/core/theme";
import { applyLocale, isLocaleId, translateError } from "@/core/locale";
import { subscribeAuth, viewUserId } from "@/core/session";
import { formatWhen } from "@/core/utils";
import { cn } from "@/lib/utils";
import { Download, Upload, Trash2, Camera, RotateCcw, Palette, Check, Wallet, Languages } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Snapshot } from "@/core/types";

const THEME_COPY: Record<ThemeId, { name: string; description: string }> = {
  "warm-dark": { name: "themes.warmDark", description: "themes.warmDarkDesc" },
  "main-light": { name: "themes.mainLight", description: "themes.mainLightDesc" },
  forest: { name: "themes.forest", description: "themes.forestDesc" },
  midnight: { name: "themes.midnight", description: "themes.midnightDesc" },
};

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: i18n.t("meta.settings") },
    { name: "description", content: i18n.t("meta.settingsDesc") },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings, load } = useStore();
  const viewingOther = useSyncExternalStore(subscribeAuth, () => !!viewUserId());
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapName, setSnapName] = useState("");

  const refreshSnaps = async () => {
    const all = await getAll<Snapshot>("snapshots");
    setSnapshots(all.sort((a, b) => b.createdAt - a.createdAt));
  };

  useEffect(() => { refreshSnaps(); }, []);

  const doExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `life-os-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.exported"));
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAll(data);
      await load();
      toast.success(t("settings.imported"));
    } catch (e: unknown) {
      toast.error(t("errors.importFailed", { message: translateError(e instanceof Error ? e.message : "Unknown error") }));
    }
  };

  const doSnapshot = async () => {
    const data = await exportAll();
    const snap: Snapshot = {
      id: uid(), name: snapName.trim() || t("settings.snapshotName", { when: formatWhen(Date.now(), "MMM d HH:mm") }),
      createdAt: Date.now(), data: JSON.stringify(data),
    };
    await putOne("snapshots", snap);
    setSnapName("");
    refreshSnaps();
    toast.success(t("settings.snapshotSaved"));
  };

  const doRestore = async (snap: Snapshot) => {
    if (!confirm(t("settings.confirmRestore", { name: snap.name }))) return;
    const data = JSON.parse(snap.data);
    await importAll(data);
    await load();
    toast.success(t("settings.restored"));
  };

  const doDeleteSnap = async (id: string) => {
    await delOne("snapshots", id);
    refreshSnaps();
  };

  const doReset = async () => {
    if (!confirm(t("settings.confirmErase"))) return;
    if (!confirm(t("settings.confirmEraseAgain"))) return;
    await clearAll();
    location.reload();
  };

  const selectTheme = async (value: string) => {
    if (!isThemeId(value) || value === settings.theme) return;
    const previous = settings.theme;
    applyTheme(value);
    try {
      await updateSettings({ theme: value });
    } catch (error) {
      applyTheme(previous);
      toast.error(translateError(error instanceof Error ? error.message : "Could not save theme"));
    }
  };

  const selectLocale = async (value: string) => {
    if (!isLocaleId(value) || value === settings.locale) return;
    const previous = settings.locale;
    await applyLocale(value);
    try {
      await updateSettings({ locale: value });
    } catch (error) {
      await applyLocale(previous);
      toast.error(translateError(error instanceof Error ? error.message : "Could not save language"));
    }
  };

  return (
    <PageContainer>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Languages className="h-4 w-4" /> {t("settings.language")}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.languageHelp")}</p>
          <RadioGroup
            value={settings.locale}
            onValueChange={(value) => void selectLocale(value)}
            aria-label={t("settings.aria")}
            className="grid sm:grid-cols-2 gap-3 max-w-xl"
          >
            {(["en", "ar"] as const).map((id) => {
              const selected = settings.locale === id;
              const label = id === "en" ? t("settings.english") : t("settings.arabic");
              return (
                <div key={id} className={cn("relative rounded-lg border bg-background", selected ? "border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/50")}>
                  <RadioGroupItem id={`locale-${id}`} value={id} aria-label={label} className="absolute end-3 top-3" />
                  <Label htmlFor={`locale-${id}`} className="block cursor-pointer p-3 pe-9 text-sm font-medium">
                    {label}
                    {selected && <Check className="ms-1.5 inline h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Palette className="h-4 w-4" /> {t("themes.appearance")}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">{t("themes.appearanceHelp")}</p>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value) => void selectTheme(value)}
            aria-label={t("themes.aria")}
            className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3"
          >
            {THEMES.map((theme) => {
              const selected = settings.theme === theme.id;
              return (
                <div
                  key={theme.id}
                  className={cn(
                    "relative rounded-lg border bg-background transition-colors",
                    selected ? "border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/50",
                  )}
                >
                  <RadioGroupItem
                    id={`theme-${theme.id}`}
                    value={theme.id}
                    aria-label={t(THEME_COPY[theme.id].name)}
                    className="absolute end-3 top-3"
                  />
                  <Label htmlFor={`theme-${theme.id}`} className="block cursor-pointer p-3 pe-9">
                    <span className="flex h-8 overflow-hidden rounded-md border mb-3" aria-hidden="true">
                      {theme.swatches.map((color, index) => (
                        <span key={color} className={cn("flex-1", index === 2 && "flex-[0.7]")} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {t(THEME_COPY[theme.id].name)}
                      {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{t(THEME_COPY[theme.id].description)}</span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {!viewingOther && (
        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Wallet className="h-4 w-4" /> {t("settings.finance")}
          </h3>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {t("settings.financeHelp")}
            </p>
            <Switch
              checked={settings.financeEnabled}
              onCheckedChange={(checked) => updateSettings({ financeEnabled: checked })}
              aria-label={t("settings.financeAria")}
            />
          </div>
        </div>
        )}

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">{t("settings.pomodoro")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{t("settings.focusMin")}</Label>
              <Input type="number" value={settings.pomodoroFocus} onChange={(e) => updateSettings({ pomodoroFocus: Number(e.target.value) || 25 })} /></div>
            <div><Label className="text-xs">{t("settings.shortBreak")}</Label>
              <Input type="number" value={settings.pomodoroBreak} onChange={(e) => updateSettings({ pomodoroBreak: Number(e.target.value) || 5 })} /></div>
            <div><Label className="text-xs">{t("settings.longBreak")}</Label>
              <Input type="number" value={settings.pomodoroLongBreak} onChange={(e) => updateSettings({ pomodoroLongBreak: Number(e.target.value) || 15 })} /></div>
            <div><Label className="text-xs">{t("settings.longEvery")}</Label>
              <Input type="number" value={settings.pomodoroLongEvery} onChange={(e) => updateSettings({ pomodoroLongEvery: Number(e.target.value) || 4 })} /></div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1">{t("settings.data")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.dataHelp")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={doExport}><Download className="h-4 w-4 me-1" /> {t("settings.exportJson")}</Button>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
                <Upload className="h-4 w-4 me-1" /> {t("settings.importJson")}
              </span>
              <input type="file" accept="application/json" className="hidden"
                onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
            </label>
            <Button variant="ghost" className="text-destructive hover:text-destructive ms-auto" onClick={doReset}>
              <Trash2 className="h-4 w-4 me-1" /> {t("settings.erase")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Camera className="h-4 w-4" /> {t("settings.snapshots")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("settings.snapshotsHelp")}</p>
          <div className="flex gap-2 mb-4">
            <Input placeholder={t("settings.snapPlaceholder")} value={snapName} onChange={(e) => setSnapName(e.target.value)} />
            <Button onClick={doSnapshot}>{t("settings.takeSnapshot")}</Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
            {snapshots.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">{t("settings.empty")}</div>}
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-surface-elevated">
                <div className="min-w-0">
                  <div className="text-sm truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{formatWhen(s.createdAt, "MMM d, yyyy HH:mm")} · {Math.round(s.data.length / 1024)} KB</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => doRestore(s)}><RotateCcw className="h-3.5 w-3.5 me-1" /> {t("common.restore")}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doDeleteSnap(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
