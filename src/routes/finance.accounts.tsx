import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtMoney } from "@/core/finance-utils";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Account, AccountType } from "@/core/finance-types";

export const Route = createFileRoute("/finance/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Finance" }] }),
  component: AccountsPage,
});

const TYPES: AccountType[] = ["cash", "bank", "savings", "credit"];

function AccountsPage() {
  const { accounts, transactions, upsertAccount, deleteAccount } = useStore();
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);

  const totalByCurrency = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Cash, bank, savings, credit. Balances update from transactions."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add account</Button>}
      />

      <div className="rounded-xl border bg-card p-4 mb-4">
        <div className="text-xs text-muted-foreground mb-1">Total balance</div>
        <div className="flex flex-wrap gap-4">
          {Object.entries(totalByCurrency).map(([cur, val]) => (
            <div key={cur} className="text-2xl font-display font-semibold tabular-nums">{fmtMoney(val, cur)}</div>
          ))}
          {accounts.length === 0 && <div className="text-sm text-muted-foreground">No accounts yet.</div>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((a) => {
          const txCount = transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
          return (
            <div key={a.id} className="rounded-xl border bg-card p-4 group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md grid place-items-center font-bold uppercase text-xs" style={{ background: `${a.color}30`, color: a.color }}>
                    {a.type[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{a.type} · {a.currency}</div>
                  </div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (confirm(`Delete "${a.name}"? Transactions will remain.`)) {
                      await deleteAccount(a.id);
                      toast.success("Account deleted");
                    }
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
              <div className="text-2xl font-display font-semibold tabular-nums">{fmtMoney(a.balance, a.currency)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{txCount} transactions · opening {fmtMoney(a.initialBalance, a.currency)}</div>
            </div>
          );
        })}
      </div>

      <AccountDialog open={open} onOpenChange={setOpen} account={editing} onSaved={() => setOpen(false)} onUpsert={upsertAccount} />
    </PageContainer>
  );
}

function AccountDialog({
  open, onOpenChange, account, onSaved, onUpsert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: Account | null;
  onSaved: () => void;
  onUpsert: (a: Partial<Account> & { name?: string }) => Promise<Account>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [initialBalance, setInitialBalance] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [color, setColor] = useState("#d4a574");

  // sync on open
  if (open && account && name === "" && account.name !== "") {
    setName(account.name);
    setType(account.type);
    setInitialBalance(String(account.initialBalance));
    setCurrency(account.currency);
    setColor(account.color ?? "#d4a574");
  }

  const reset = () => { setName(""); setType("cash"); setInitialBalance("0"); setCurrency("USD"); setColor("#d4a574"); };

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    const isNew = !account;
    await onUpsert({
      id: account?.id, name: name.trim(), type,
      initialBalance: Number(initialBalance) || 0,
      currency: currency.trim().toUpperCase() || "USD",
      color,
    });
    toast.success(isNew ? "Account added" : "Account updated");
    reset();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main bank" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="LBP">LBP — Lebanese Lira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Opening balance</Label>
              <Input type="number" step="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}>{account ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
