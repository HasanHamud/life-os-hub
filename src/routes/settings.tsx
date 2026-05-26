import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportAll, importAll, clearAll, putOne, getAll, delOne, uid } from "@/core/db";
import { Download, Upload, Trash2, Camera, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Snapshot } from "@/core/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — Life OS" },
    { name: "description", content: "Workday hours, notifications, import/export and snapshots." },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings, load } = useStore();
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
    toast.success("Exported");
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAll(data);
      await load();
      toast.success("Imported");
    } catch (e: any) {
      toast.error("Import failed: " + e.message);
    }
  };

  const doSnapshot = async () => {
    const data = await exportAll();
    const snap: Snapshot = {
      id: uid(), name: snapName.trim() || `Snapshot ${format(new Date(), "MMM d HH:mm")}`,
      createdAt: Date.now(), data: JSON.stringify(data),
    };
    await putOne("snapshots", snap);
    setSnapName("");
    refreshSnaps();
    toast.success("Snapshot saved");
  };

  const doRestore = async (snap: Snapshot) => {
    if (!confirm(`Restore "${snap.name}"? This replaces all current data.`)) return;
    const data = JSON.parse(snap.data);
    await importAll(data);
    await load();
    toast.success("Restored");
  };

  const doDeleteSnap = async (id: string) => {
    await delOne("snapshots", id);
    refreshSnaps();
  };

  const doReset = async () => {
    if (!confirm("Erase ALL data? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    await clearAll();
    location.reload();
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Preferences, data export/import, and version snapshots." />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Workday</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start hour</Label>
              <Input type="number" min={0} max={23} value={settings.workdayStart}
                onChange={(e) => updateSettings({ workdayStart: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">End hour</Label>
              <Input type="number" min={0} max={23} value={settings.workdayEnd}
                onChange={(e) => updateSettings({ workdayEnd: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Pomodoro</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Focus (min)</Label>
              <Input type="number" value={settings.pomodoroFocus} onChange={(e) => updateSettings({ pomodoroFocus: Number(e.target.value) || 25 })} /></div>
            <div><Label className="text-xs">Short break</Label>
              <Input type="number" value={settings.pomodoroBreak} onChange={(e) => updateSettings({ pomodoroBreak: Number(e.target.value) || 5 })} /></div>
            <div><Label className="text-xs">Long break</Label>
              <Input type="number" value={settings.pomodoroLongBreak} onChange={(e) => updateSettings({ pomodoroLongBreak: Number(e.target.value) || 15 })} /></div>
            <div><Label className="text-xs">Long every</Label>
              <Input type="number" value={settings.pomodoroLongEvery} onChange={(e) => updateSettings({ pomodoroLongEvery: Number(e.target.value) || 4 })} /></div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1">Data</h3>
          <p className="text-xs text-muted-foreground mb-4">Everything lives in your browser's IndexedDB.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={doExport}><Download className="h-4 w-4 mr-1" /> Export JSON</Button>
            <label className="cursor-pointer">
              <span className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
                <Upload className="h-4 w-4 mr-1" /> Import JSON
              </span>
              <input type="file" accept="application/json" className="hidden"
                onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
            </label>
            <Button variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={doReset}>
              <Trash2 className="h-4 w-4 mr-1" /> Erase all data
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Camera className="h-4 w-4" /> Snapshots</h3>
          <p className="text-xs text-muted-foreground mb-4">Local versioned backups. Restore any point in time.</p>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Snapshot name (optional)" value={snapName} onChange={(e) => setSnapName(e.target.value)} />
            <Button onClick={doSnapshot}>Take snapshot</Button>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
            {snapshots.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No snapshots yet.</div>}
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-surface-elevated">
                <div className="min-w-0">
                  <div className="text-sm truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{format(s.createdAt, "MMM d, yyyy HH:mm")} · {Math.round(s.data.length / 1024)} KB</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => doRestore(s)}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore</Button>
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
