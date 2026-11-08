import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/core/store";
import i18n from "@/core/i18n";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtMoney, convertCurrency } from "@/core/finance-utils";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Account, AccountType } from "@/core/finance-types";

export const Route = createFileRoute("/finance/accounts")({
  head: () => ({ meta: [{ title: i18n.t("meta.accounts") }] }),
  component: AccountsPage,
});

const TYPES: AccountType[] = ["cash", "bank", "savings", "credit"];

function AccountsPage() {
  const { t } = useTranslation();
  const { accounts, transactions, settings, upsertAccount, deleteAccount } = useStore();
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);

  const totalByCurrency = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  const totalInBase = accounts.reduce(
    (sum, a) => sum + convertCurrency(a.balance, a.currency, settings.baseCurrency, settings.usdToLbpRate),
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("finance.accounts")}
        description="Cash, bank, savings, credit. Balances update from transactions."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 me-1" /> {t("finance.addAccount")}</Button>}
      />

      <div className="rounded-xl border bg-card p-4 mb-4">
        <div className="text-xs text-muted-foreground mb-1">
          Total balance <span className="opacity-70">(in {settings.baseCurrency} @ 1 USD = {settings.usdToLbpRate.toLocaleString()} LBP)</span>
        </div>
        <div className="text-3xl font-display font-semibold tabular-nums mb-3">
          {fmtMoney(totalInBase, settings.baseCurrency)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(totalByCurrency).map(([cur, val]) => (
            <div key={cur} className="tabular-nums">{cur}: {fmtMoney(val, cur)}</div>
          ))}
          {accounts.length === 0 && <div>{t("more.noAccounts")}</div>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((a) => {
          const txCount = transactions.filter((tx) => tx.accountId === a.id || tx.toAccountId === a.id).length;
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
                    if (confirm(t("finance.deleteAccount", { name: a.name }))) {
                      await deleteAccount(a.id);
                      toast.success(t("finance.accountDeleted"));
                    }
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
              <div className="text-2xl font-display font-semibold tabular-nums">{fmtMoney(a.balance, a.currency)}</div>
              {a.currency !== settings.baseCurrency && (
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  ≈ {fmtMoney(convertCurrency(a.balance, a.currency, settings.baseCurrency, settings.usdToLbpRate), settings.baseCurrency)}
                </div>
              )}
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
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [initialBalance, setInitialBalance] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [color, setColor] = useState("#d4a574");

  // sync on open
  useEffect(() => {
    if (open && account) {
      setName(account.name);
      setType(account.type);
      setInitialBalance(String(account.initialBalance));
      setCurrency(account.currency);
      setColor(account.color ?? "#d4a574");
    } else if (!open) {
      reset();
    }
  }, [open, account]);

  const reset = () => { setName(""); setType("cash"); setInitialBalance("0"); setCurrency("USD"); setColor("#d4a574"); };

  const submit = async () => {
    if (!name.trim()) return toast.error(t("errors.nameRequired"));
    const isNew = !account;
    await onUpsert({
      id: account?.id, name: name.trim(), type,
      initialBalance: Number(initialBalance) || 0,
      currency: currency.trim().toUpperCase() || "USD",
      color,
    });
    toast.success(isNew ? t("finance.accountAdded") : t("finance.accountUpdated"));
    reset();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("finance.bankPh")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("common.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((accountType) => <SelectItem key={accountType} value={accountType} className="capitalize">{accountType}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("more.currency")}</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">{t("more.usd")}</SelectItem>
                  <SelectItem value="LBP">{t("more.lbp")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("more.opening")}</Label>
              <Input type="number" step="0.01" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("common.color")}</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>{t("common.cancel")}</Button>
          <Button onClick={submit}>{account ? t("common.save") : t("finance.add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
