"use client";
import { Archive, ArchiveRestore, ArrowLeftRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { DynIcon, ACCOUNT_ICONS } from "@/components/ui/icon";
import { Badge, EmptyState, ErrorState, Modal, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { minorToInput, parseAmount } from "@/lib/money";
import type { AccountRow, AccountType } from "@/types/db";

const TYPES: Record<AccountType, string> = { checking: "Compte courant", savings: "Épargne", cash: "Espèces", secondary: "Compte secondaire", business: "Compte professionnel", wallet: "Portefeuille numérique", other: "Autre" };
const COLORS = ["#7357F6", "#22C55E", "#F59E0B", "#0EA5E9", "#EC4899", "#14B8A6", "#64748B"];

function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: AccountRow | null }) {
  const create = useMutationOp("accounts.create", { success: "Compte créé" });
  const update = useMutationOp("accounts.update", { success: "Compte modifié" });
  const [v, setV] = useState({ name: "", type: "checking" as AccountType, initial: "", color: COLORS[0]!, icon: "wallet" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) setV(account ? { name: account.name, type: account.type, initial: minorToInput(account.initial_balance_minor), color: account.color, icon: account.icon } : { name: "", type: "checking", initial: "", color: COLORS[0]!, icon: "wallet" });
    setErr(null);
  }, [open, account]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const initial = v.initial.trim() === "" ? 0 : parseAmount(v.initial);
    if (!v.name.trim()) return setErr("Donne un nom au compte");
    if (initial === null) return setErr("Solde initial invalide");
    const payload = { name: v.name.trim(), type: v.type, initial_balance_minor: initial, color: v.color, icon: v.icon };
    if (account) await update.mutateAsync({ id: account.id, ...payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={account ? "Modifier le compte" : "Nouveau compte"} description="Le solde initial est le solde du compte avant la première opération que tu enregistres.">
      <form onSubmit={submit} className="grid gap-4">
        {err ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</p> : null}
        <Field label="Nom" htmlFor="acc-name"><Input id="acc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex. Compte courant" maxLength={60} autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="acc-type"><Select id="acc-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as AccountType })}>{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Solde initial" htmlFor="acc-initial" hint="Négatif si découvert, ex. -25,50"><MoneyInput id="acc-initial" value={v.initial} onChange={(e) => setV({ ...v, initial: e.target.value })} placeholder="0,00" /></Field>
        </div>
        <fieldset><legend className="mb-1.5 text-sm font-medium">Couleur</legend><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button type="button" key={c} aria-label={`Couleur ${c}`} aria-pressed={v.color === c} onClick={() => setV({ ...v, color: c })} className={`size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-surface ${v.color === c ? "ring-2 ring-foreground" : ""}`} style={{ background: c }} />)}</div></fieldset>
        <fieldset><legend className="mb-1.5 text-sm font-medium">Icône</legend><div className="flex flex-wrap gap-2">{ACCOUNT_ICONS.map((i) => <button type="button" key={i} aria-label={`Icône ${i}`} aria-pressed={v.icon === i} onClick={() => setV({ ...v, icon: i })} className={`cursor-pointer rounded-xl border p-2 ${v.icon === i ? "border-brand bg-brand-soft text-brand" : "border-border"}`}><DynIcon name={i} className="size-5" /></button>)}</div></fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={create.isPending || update.isPending}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

function TransferDialog({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: { id: string; name: string; is_archived: boolean }[] }) {
  const transfer = useMutationOp("transfers.create", { success: "Transfert enregistré" });
  const active = accounts.filter((a) => !a.is_archived);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [v, setV] = useState({ from: "", to: "", amount: "", date: today, label: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setV({ from: active[0]?.id ?? "", to: active[1]?.id ?? "", amount: "", date: today, label: "" }); setErr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Transfert entre comptes" description="Un transfert déplace de l'argent entre tes comptes : il n'est jamais compté comme revenu ou dépense.">
      <form className="grid gap-4" onSubmit={async (e) => {
        e.preventDefault();
        const amount = parseAmount(v.amount);
        if (!amount || amount <= 0) return setErr("Montant invalide");
        if (v.from === v.to) return setErr("Choisis deux comptes différents");
        await transfer.mutateAsync({ from_account_id: v.from, to_account_id: v.to, amount_minor: amount, date: v.date, label: v.label || null });
        onOpenChange(false);
      }}>
        {err ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Depuis" htmlFor="tr-from"><Select id="tr-from" value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Vers" htmlFor="tr-to"><Select id="tr-to" value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Montant" htmlFor="tr-amount"><MoneyInput id="tr-amount" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0,00" /></Field>
          <Field label="Date" htmlFor="tr-date"><Input id="tr-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        </div>
        <Field label="Libellé (facultatif)" htmlFor="tr-label"><Input id="tr-label" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} maxLength={120} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={transfer.isPending || active.length < 2}>Transférer</Button></div>
      </form>
    </Modal>
  );
}

function AccountsContent() {
  const params = useSearchParams();
  const q = useOp("accounts.list", {});
  const update = useMutationOp("accounts.update");
  const del = useMutationOp("accounts.delete", { success: "Compte supprimé" });
  const [edit, setEdit] = useState<AccountRow | null>(null);
  const [open, setOpen] = useState(params.get("new") === "1");
  const [transferOpen, setTransferOpen] = useState(false);
  const [toDelete, setToDelete] = useState<(AccountRow & { transactionCount: number }) | null>(null);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const { accounts, totals } = q.data;
  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

  return (
    <>
      <PageHeader title="Mon argent" description="Tous tes comptes, leurs soldes calculés à partir de tes opérations, et les transferts entre eux."
        actions={<><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus /> Compte</Button><Button variant="outline" onClick={() => setTransferOpen(true)} disabled={active.length < 2}><ArrowLeftRight /> Transfert</Button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Solde total", totals.total], ["Disponible (hors épargne)", totals.available], ["Épargne", totals.savings], ["En attente", totals.pending]].map(([l, v]) => (
          <Card key={l as string} className="p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 font-display text-xl font-bold"><Money value={v as number} /></p></Card>
        ))}
      </div>
      {!accounts.length ? (
        <EmptyState icon={Wallet} title="Aucun compte" description="Ajoute ton compte courant, ton épargne ou tes espèces. Aucune connexion bancaire n'est nécessaire." action={<Button onClick={() => setOpen(true)}><Plus /> Ajouter un compte</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <div className="h-1.5" style={{ background: a.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl p-2.5 text-white" style={{ background: a.color }}><DynIcon name={a.icon} className="size-5" /></span>
                    <div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted">{TYPES[a.type]} · {a.currency}</p></div>
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${a.name}`} onClick={() => { setEdit(a); setOpen(true); }}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Archiver ${a.name}`} onClick={() => update.mutate({ id: a.id, is_archived: true })}><Archive /></Button>
                  </div>
                </div>
                <p className="mt-4 font-display text-3xl font-bold"><Money value={a.booked} colored={a.booked < 0} /></p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted">Disponible</dt><dd className="font-semibold tabular"><Money value={a.available} /></dd></div>
                  <div><dt className="text-muted">En attente</dt><dd className="font-semibold tabular"><Money value={a.pending} /></dd></div>
                  <div><dt className="text-muted">Programmé</dt><dd className="font-semibold tabular"><Money value={a.scheduled} /></dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted">{a.transactionCount} opération(s) · solde initial <Money value={a.initial_balance_minor} /></span>
                  <Link href={`/app/transactions?account=${a.id}`} className="font-semibold text-brand">Historique</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {archived.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">Comptes archivés</h2>
          <div className="grid gap-2">
            {archived.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><Badge>Archivé</Badge>{a.name} · <Money value={a.booked} /></span>
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: a.id, is_archived: false })}><ArchiveRestore /> Restaurer</Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setToDelete(a)}><Trash2 /> Supprimer</Button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <AccountDialog open={open} onOpenChange={setOpen} account={edit} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} accounts={accounts} />
      <Modal open={!!toDelete} onOpenChange={() => setToDelete(null)} title="Supprimer définitivement ?" description={`Le compte « ${toDelete?.name} » et ses ${toDelete?.transactionCount ?? 0} opérations seront supprimés. Cette action est irréversible.`}
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Annuler</Button><Button variant="danger" onClick={async () => { await del.mutateAsync({ id: toDelete!.id, confirm: true }); setToDelete(null); }}>Supprimer</Button></>}>
        <p className="text-sm text-muted">Astuce : l'archivage masque le compte sans perdre l'historique.</p>
      </Modal>
    </>
  );
}

export default function AccountsPage() {
  return <Suspense><AccountsContent /></Suspense>;
}
