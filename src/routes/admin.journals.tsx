import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DayPickerButton } from "@/components/journal/DayPicker";
import { authState } from "@/core/session";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; journalEntries: number };

type JournalEntry = {
  id: string;
  userId: string;
  userName?: string | null;
  date: string;
  content: string;
  createdAt: number;
  mood?: number | null;
  energy?: number | null;
  adminNote: string | null;
  adminNoteAt: number | null;
  adminNoteBy: string | null;
};

export const Route = createFileRoute("/admin/journals")({
  head: () => ({ meta: [{ title: "Journals — Admin" }] }),
  component: AdminJournalsPage,
});

function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function shiftDay(day: string, amount: number) {
  return format(addDays(parseDay(day), amount), "yyyy-MM-dd");
}

function AdminJournalsPage() {
  const { t } = useTranslation();
  const me = authState().user;
  const today = format(new Date(), "yyyy-MM-dd");
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState("all");
  const [day, setDay] = useState<string | null>(today);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (me?.role !== "admin") return;
    let cancel = false;
    const params = new URLSearchParams();
    if (selected !== "all") params.set("userId", selected);
    if (day) params.set("date", day);
    const query = params.toString();
    const url = query ? `/api/admin/journals?${query}` : "/api/admin/journals";
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancel) return;
        if (!res.ok) {
          setEntries([]);
          setError(data.error || "Could not load journals");
          return;
        }
        setPeople(data.people ?? []);
        setEntries(data.entries ?? []);
        // #region agent log
        fetch("http://127.0.0.1:7358/ingest/16520233-05b9-4a47-9ef8-1e4a695755c4",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ae3054"},body:JSON.stringify({sessionId:"ae3054",runId:"post-fix",hypothesisId:"B",location:"admin.journals.tsx:load",message:"journals page loaded",data:{url,people:(data.people??[]).length,entries:(data.entries??[]).length,fetchedOverview:false,fetchedActivity:false},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      })
      .catch((err) => {
        if (!cancel) setError(err.message);
      });
    return () => { cancel = true; };
  }, [me?.role, selected, day]);

  async function saveNote(entry: JournalEntry, note: string) {
    setError("");
    const res = await fetch(`/api/admin/people/${entry.userId}/journals/${entry.id}/note`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Could not save the note";
      setError(message);
      throw new Error(message);
    }
    setEntries((rows) => rows.map((row) => (row.id === entry.id ? { ...row, ...data } : row)));
  }

  if (me?.role !== "admin") {
    return (
      <PageContainer>
        <PageHeader title="Journals" description="Only a manager can open this page." />
      </PageContainer>
    );
  }

  const person = people.find((item) => item.id === selected);

  return (
    <PageContainer>
      <PageHeader
        title="Journals"
        description={t("journal.adminDescription")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={!day} onClick={() => day && setDay(shiftDay(day, -1))} aria-label={t("journal.prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DayPickerButton day={day} onChange={setDay} />
            <Button size="sm" variant="outline" onClick={() => setDay(today)}>{t("common.today")}</Button>
            <Button size="sm" variant="ghost" disabled={!day} onClick={() => day && setDay(shiftDay(day, 1))} aria-label={t("journal.next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={day ? "ghost" : "outline"} onClick={() => setDay(null)}>{t("journal.allDates")}</Button>
          </div>
        }
      />
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-xl border bg-card p-2">
          <PersonButton active={selected === "all"} label="All" count={people.reduce((sum, item) => sum + item.journalEntries, 0)} onClick={() => setSelected("all")} />
          {people.map((item) => (
            <PersonButton key={item.id} active={selected === item.id} label={item.name} count={item.journalEntries} onClick={() => setSelected(item.id)} />
          ))}
        </aside>
        <div className="space-y-6">
          {selected !== "all" && !day && <h2 className="text-sm font-semibold">{person?.name}</h2>}
          {day ? (
            <DayLog
              day={day}
              people={selected === "all" ? people : people.filter((item) => item.id === selected)}
              entries={entries}
              onSave={saveNote}
              empty={t("journal.noEntry")}
            />
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journal entries yet.</p>
          ) : groupByDate(entries).map((group) => (
            <section key={group.date}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {format(parseDay(group.date), "EEEE, MMMM d, yyyy")}
              </h3>
              <div className="space-y-4">
                {(selected === "all" ? groupByUser(group.rows) : [{ id: selected, name: "", rows: group.rows }]).map((userGroup) => (
                  <div key={userGroup.id}>
                    {selected === "all" && <h4 className="mb-2 text-sm font-medium">{userGroup.name}</h4>}
                    <div className="space-y-3">
                      {userGroup.rows.map((entry) => (
                        <EntryCard key={entry.id} entry={entry} onSave={saveNote} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

function DayLog({
  day,
  people,
  entries,
  onSave,
  empty,
}: {
  day: string;
  people: Person[];
  entries: JournalEntry[];
  onSave: (entry: JournalEntry, note: string) => Promise<void>;
  empty: string;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {format(parseDay(day), "EEEE, MMMM d, yyyy")}
      </h3>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No journal entries yet.</p>
      ) : (
        <div className="space-y-5">
          {people.map((person) => {
            const rows = entries
              .filter((entry) => entry.userId === person.id)
              .sort((a, b) => a.createdAt - b.createdAt);
            return (
              <div key={person.id}>
                <h4 className="mb-2 text-sm font-medium">{person.name}</h4>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{empty}</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} onSave={onSave} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PersonButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm",
        active ? "bg-muted font-medium" : "hover:bg-muted/60",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function EntryCard({ entry, onSave }: { entry: JournalEntry; onSave: (entry: JournalEntry, note: string) => Promise<void> }) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="mb-2 text-xs text-muted-foreground">
        {new Date(entry.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        {entry.mood ? ` · mood ${entry.mood}/5` : ""}
        {entry.energy ? ` · energy ${entry.energy}/5` : ""}
      </div>
      <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
      {entry.adminNote && (
        <p className="mt-2 text-xs text-muted-foreground">
          Current note from {entry.adminNoteBy || "admin"}
          {entry.adminNoteAt ? ` · ${new Date(entry.adminNoteAt).toLocaleString()}` : ""}
        </p>
      )}
      <NoteEditor
        key={`${entry.id}-${entry.adminNoteAt || 0}`}
        note={entry.adminNote || ""}
        onSave={(note) => onSave(entry, note)}
      />
    </article>
  );
}

function NoteEditor({ note, onSave }: { note: string; onSave: (note: string) => Promise<void> }) {
  const [value, setValue] = useState(note);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          await onSave(value);
        } catch {
          /* the page shows the error */
        } finally {
          setBusy(false);
        }
      }}
    >
      <Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} placeholder="Note for this journal entry" />
      <Button type="submit" size="sm" disabled={busy}>Save note</Button>
    </form>
  );
}

function groupByUser(rows: JournalEntry[]) {
  const order: string[] = [];
  const map = new Map<string, JournalEntry[]>();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, []);
      order.push(row.userId);
    }
    map.get(row.userId)!.push(row);
  }
  return order.map((id) => ({ id, name: map.get(id)![0].userName || "Unknown", rows: map.get(id)! }));
}

function groupByDate(rows: JournalEntry[]) {
  const order: string[] = [];
  const map = new Map<string, JournalEntry[]>();
  for (const row of rows) {
    if (!map.has(row.date)) {
      map.set(row.date, []);
      order.push(row.date);
    }
    map.get(row.date)!.push(row);
  }
  return order.map((date) => ({ date, rows: map.get(date)! }));
}
