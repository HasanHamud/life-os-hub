import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { translateError } from "@/core/locale";
import { formatWhen } from "@/core/utils";
import { AlertTriangle, Clock, ListChecks, UserCheck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/common/ChartCard";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authState, setWorkspaceView } from "@/core/session";

type Person = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  active: boolean;
  openTasks: number;
  overdueTasks: number;
  tasksDone7d: number;
  journalEntries: number;
  notes: number;
  learningSessions7d: number;
  focusMinutes: number;
  lastChange: number | null;
};

type Overview = {
  people: number;
  activeAccounts: number;
  openTasks: number;
  overdueTasks: number;
  focusMinutes: number;
  focusByPerson: { name: string; minutes: number }[];
  tasksPerDay: { date: string; tasksDone: number }[];
  byPerson: Person[];
};

type Activity = {
  userId: string;
  actorId: string;
  area: string;
  action: string;
  count: number;
  at: number;
  userName: string | null;
  actorName: string | null;
};

const AREA_KEYS: Record<string, string> = {
  tasks: "nav.tasks",
  projects: "nav.projects",
  goals: "nav.goals",
  sessions: "nav.focus",
  tags: "common.tags",
  logs: "admin.journal",
  settings: "common.settings",
  accounts: "nav.accounts",
  transactions: "admin.transactions",
  categories: "nav.categories",
  budgets: "nav.budgets",
  savingsGoals: "nav.savings",
  notes: "admin.notes",
  concepts: "learn.concepts",
  insights: "learn.insights",
  problems: "learn.problems",
  snapshots: "settings.snapshots",
  account: "admin.account",
};

const AREA_LABELS: Record<string, string> = {
  tasks: "Tasks",
  timeBlocks: "Time blocks",
  projects: "Projects",
  goals: "Goals",
  sessions: "Focus",
  tags: "Tags",
  logs: "Journal",
  settings: "Settings",
  accounts: "Accounts",
  transactions: "Transactions",
  categories: "Categories",
  budgets: "Budgets",
  savingsGoals: "Savings",
  notes: "Notes",
  concepts: "Concepts",
  insights: "Insights",
  problems: "Problems",
  learningSessions: "Learning",
  rotationEntries: "Rotation",
  weeklyPlans: "Weekly plans",
  weekTemplates: "Week templates",
  snapshots: "Snapshots",
  account: "Account",
  workspace: "Workspace",
};

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  cleared: "cleared",
  imported: "imported",
  "signed-in": "signed in",
  enabled: "enabled",
  disabled: "disabled",
  "set-password": "set a password",
  noted: "noted",
};

const PAGE_SIZES = [10, 20, 50, 100];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function AdminRoute() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/admin") return <Outlet />;
  return <AdminPage />;
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: i18n.t("meta.admin") }] }),
  component: AdminRoute,
});

function areaLabel(area: string, t: (key: string) => string) {
  return AREA_KEYS[area] ? t(AREA_KEYS[area]) : (AREA_LABELS[area] || area);
}

function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = authState().user;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const people = overview?.byPerson ?? [];

  async function load() {
    const [overviewRes, activityRes] = await Promise.all([
      fetch("/api/admin/overview", { credentials: "include" }),
      fetch("/api/admin/activity", { credentials: "include" }),
    ]);
    const overviewData = await overviewRes.json().catch(() => ({}));
    const activityData = await activityRes.json().catch(() => ({}));
    if (!overviewRes.ok) throw new Error(overviewData.error || "Could not load the dashboard");
    if (!activityRes.ok) throw new Error(activityData.error || "Could not load activity");
    setOverview(overviewData);
    setActivity(activityData);
  }

  useEffect(() => {
    if (me?.role !== "admin") return;
    // #region agent log
    fetch("http://127.0.0.1:7358/ingest/16520233-05b9-4a47-9ef8-1e4a695755c4",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ae3054"},body:JSON.stringify({sessionId:"ae3054",runId:"post-fix",hypothesisId:"A",location:"admin.tsx:mount",message:"admin dashboard sections",data:{focus:true,activity:true,journalSection:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    load().catch((err) => setError(translateError(err instanceof Error ? err.message : "Could not load the dashboard")));
  }, [me?.role]);

  if (me?.role !== "admin") {
    return (
      <PageContainer>
        <PageHeader title={t("admin.title")} description="Only an admin can open this page." />
      </PageContainer>
    );
  }

  async function createPerson(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create the account");
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : "Could not create the account"));
    } finally {
      setBusy(false);
    }
  }

  async function setActive(person: Person, active: boolean) {
    setError("");
    const res = await fetch(`/api/admin/people/${person.id}/active`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(translateError(data.error || "Could not update the account"));
      return;
    }
    await load();
  }

  async function resetPassword(person: Person, next: string) {
    setError("");
    const res = await fetch(`/api/admin/people/${person.id}/password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Could not set the password";
      setError(translateError(message));
      throw new Error(message);
    }
  }

  function openWorkspace(person: Person) {
    if (!me) return;
    setWorkspaceView(person.id === me.id ? null : { id: person.id, name: person.name });
    navigate({ to: "/" });
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("admin.title")}
        description="Totals and a log of sign-ins and changes. Open a workspace to read the actual records."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <AdminStat icon={Users} label={t("admin.people")} value={overview?.people ?? 0} />
        <AdminStat icon={UserCheck} label="Active accounts" value={overview?.activeAccounts ?? 0} />
        <AdminStat icon={ListChecks} label="Open tasks" value={overview?.openTasks ?? 0} />
        <AdminStat icon={AlertTriangle} label={t("admin.overdue")} value={overview?.overdueTasks ?? 0} />
        <AdminStat icon={Clock} label={t("admin.focus7")} value={`${overview?.focusMinutes ?? 0} min`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Focus minutes by person — last 7 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={overview?.focusByPerson ?? []}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="minutes" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tasks completed — last 14 days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={overview?.tasksPerDay ?? []}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--chart-text)", fontSize: 10 }} interval={1} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="tasksDone" stroke="var(--chart-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ActivityLog activity={activity} onChanged={load} onError={setError} />

      <h2 className="mb-3 text-sm font-semibold">{t("admin.people")}</h2>
      <form onSubmit={createPerson} className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="person-name">{t("common.name")}</Label>
          <Input id="person-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="person-email">{t("common.email")}</Label>
          <Input id="person-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="person-password">{t("admin.tempPassword")}</Label>
          <Input id="person-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>{t("admin.addPerson")}</Button>
        </div>
      </form>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-start text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("admin.person")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.open")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.overdue")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.done7")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.focus7")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.journal")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.notes")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.learn7")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.latest")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.account")}</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <div className="font-medium">{person.name}</div>
                  <div className="text-xs text-muted-foreground">{person.email}</div>
                  <div className="text-xs text-muted-foreground">{person.role}{person.active ? "" : " · disabled"}</div>
                </td>
                <td className="px-3 py-3">{person.openTasks}</td>
                <td className="px-3 py-3">{person.overdueTasks}</td>
                <td className="px-3 py-3">{person.tasksDone7d}</td>
                <td className="px-3 py-3">{person.focusMinutes} min</td>
                <td className="px-3 py-3">{person.journalEntries}</td>
                <td className="px-3 py-3">{person.notes}</td>
                <td className="px-3 py-3">{person.learningSessions7d}</td>
                <td className="px-3 py-3">{person.lastChange ? formatWhen(person.lastChange, "PPp") : "No activity"}</td>
                <td className="px-3 py-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openWorkspace(person)}>{t("admin.openWorkspace")}</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={person.id === me.id}
                      onClick={() => setActive(person, !person.active)}
                    >
                      {person.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                  <PasswordReset onSubmit={(next) => resetPassword(person, next)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}

function ActivityLog({ activity, onChanged, onError }: { activity: Activity[]; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([{ id: "at", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const columns = useMemo<ColumnDef<Activity>[]>(() => [
    {
      id: "person",
      accessorFn: (row) => row.userName || "",
      header: t("admin.person"),
      cell: ({ row }) => row.original.userName || t("common.unknown"),
    },
    {
      id: "area",
      accessorFn: (row) => areaLabel(row.area, t),
      header: t("admin.area"),
    },
    {
      id: "action",
      accessorFn: (row) => ACTION_LABELS[row.action] || row.action,
      header: t("admin.action"),
      cell: ({ row }) => {
        const item = row.original;
        const by = item.actorId !== item.userId && item.actorName ? ` · by ${item.actorName}` : "";
        return `${ACTION_LABELS[item.action] || item.action}${by}`;
      },
    },
    { accessorKey: "count", header: t("admin.count") },
    {
      accessorKey: "at",
      header: t("admin.when"),
      cell: ({ getValue }) => formatWhen(getValue<number>(), "PPp"),
    },
  ], [t]);
  const table = useReactTable({
    data: activity,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => `${row.at}-${row.userId}-${row.actorId}-${row.area}-${row.action}`,
  });

  async function removeRange() {
    setBusy(true);
    onError("");
    try {
      const res = await fetch("/api/admin/activity", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete activity");
      setConfirming(false);
      await onChanged();
    } catch (err) {
      onError(translateError(err instanceof Error ? err.message : "Could not delete activity"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-lg border">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.activity")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="activity-from" className="text-xs">{t("admin.from")}</Label>
            <Input id="activity-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-to" className="text-xs">{t("admin.to")}</Label>
            <Input id="activity-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 w-36" />
          </div>
          <Button type="button" size="sm" variant="outline" disabled={!from || !to} onClick={() => setConfirming(true)}>{t("admin.deleteDates")}</Button>
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.rows")}</Label>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => setPagination({ pageIndex: 0, pageSize: Number(value) })}
            >
              <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {activity.length === 0
        ? <p className="px-3 py-4 text-sm text-muted-foreground">{t("admin.empty")}</p>
        : <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} className="text-start">
                      <button type="button" className="font-medium" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>}
      <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
        <Button type="button" size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>{t("common.previous")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>{t("common.next")}</Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDelete", { from, to })}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDeleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void removeRange(); }}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AdminStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PasswordReset({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setDone(false);
        try {
          await onSubmit(password);
          setPassword("");
          setDone(true);
        } catch {
          setDone(false);
        }
      }}
    >
      <Input
        type="password"
        value={password}
        placeholder={t("admin.newPassword")}
        minLength={8}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <Button type="submit" size="sm" variant="outline">{done ? "Saved" : "Set password"}</Button>
    </form>
  );
}
