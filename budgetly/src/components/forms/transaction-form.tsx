"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/misc";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { minorToInput, parseAmount } from "@/lib/money";
import type { TransactionRow } from "@/types/db";

const schema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.string().refine((v) => (parseAmount(v) ?? 0) > 0, "Indique un montant positif, par ex. 12,50"),
  label: z.string().trim().min(1, "Libellé requis").max(200),
  account_id: z.string().min(1, "Choisis un compte"),
  category_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  status: z.enum(["booked", "pending"]),
  description: z.string().max(1000),
});
type Values = z.infer<typeof schema>;

export function TransactionFormDialog({ open, onOpenChange, initial, defaultType = "expense" }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: TransactionRow | null; defaultType?: "expense" | "income";
}) {
  const meta = useOp("transactions.list", { pageSize: 5 }, { enabled: open });
  const create = useMutationOp("transactions.create", { success: "Opération ajoutée" });
  const update = useMutationOp("transactions.update", { success: "Opération modifiée" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const isTransfer = !!initial?.transfer_group_id;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: defaultType, amount: "", label: "", account_id: "", category_id: "", date: today, status: "booked", description: "" },
  });
  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = form;

  useEffect(() => {
    if (!open) return;
    reset(initial ? {
      type: initial.type === "income" ? "income" : "expense", amount: minorToInput(initial.amount_minor), label: initial.label, account_id: initial.account_id,
      category_id: initial.category_id ?? "", date: initial.date, status: initial.status, description: initial.description ?? "",
    } : { type: defaultType, amount: "", label: "", account_id: "", category_id: "", date: today, status: "booked", description: "" });
  }, [open, initial, defaultType, reset, today]);

  const accounts = useMemo(() => (meta.data?.accounts ?? []).filter((a) => !a.is_archived), [meta.data]);
  useEffect(() => {
    if (open && !initial && accounts.length && !form.getValues("account_id")) setValue("account_id", accounts.find((a) => a.type === "checking")?.id ?? accounts[0]!.id);
  }, [open, initial, accounts, setValue, form]);

  const type = useWatch({ control, name: "type" });
  const categories = (meta.data?.categories ?? []).filter((c) => c.kind === "both" || c.kind === type);

  const onSubmit = async (v: Values) => {
    const base = { label: v.label, amount_minor: parseAmount(v.amount)!, date: v.date, description: v.description || null };
    if (initial) {
      await update.mutateAsync(isTransfer ? { id: initial.id, ...base } : { id: initial.id, ...base, type: v.type, account_id: v.account_id, category_id: v.category_id || null, status: v.status });
    } else {
      await create.mutateAsync({ ...base, type: v.type, account_id: v.account_id, category_id: v.category_id || null, status: v.status });
    }
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Modifier l'opération" : "Nouvelle opération"} description={isTransfer ? "Transfert interne : le montant, la date et le libellé sont modifiés sur les deux comptes." : "Sans catégorie choisie, BUDGETLY en propose une à partir du libellé."}>
      {!accounts.length && meta.isSuccess ? (
        <p className="text-sm text-muted">Ajoute d'abord un compte dans « Mon argent ».</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          {!isTransfer ? (
            <div role="radiogroup" aria-label="Type d'opération" className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
              {(["expense", "income"] as const).map((t) => (
                <button type="button" key={t} role="radio" aria-checked={type === t} onClick={() => { setValue("type", t); setValue("category_id", ""); }}
                  className={`cursor-pointer rounded-lg py-2 text-sm font-semibold ${type === t ? (t === "expense" ? "bg-surface text-danger shadow-sm" : "bg-surface text-positive shadow-sm") : "text-muted"}`}>
                  {t === "expense" ? "Dépense" : "Revenu"}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant" htmlFor="tx-amount" error={errors.amount?.message}>
              <MoneyInput id="tx-amount" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} autoFocus />
            </Field>
            <Field label="Date" htmlFor="tx-date" error={errors.date?.message}>
              <Input id="tx-date" type="date" {...register("date")} />
            </Field>
          </div>
          <Field label="Libellé" htmlFor="tx-label" error={errors.label?.message}>
            <Input id="tx-label" placeholder="Ex. Courses Carrefour" aria-invalid={!!errors.label} {...register("label")} />
          </Field>
          {!isTransfer ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Compte" htmlFor="tx-account" error={errors.account_id?.message}>
                <Select id="tx-account" {...register("account_id")}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Catégorie" htmlFor="tx-category">
                <Select id="tx-category" {...register("category_id")}>
                  <option value="">Automatique</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
          ) : null}
          {!isTransfer ? (
            <Field label="Statut" htmlFor="tx-status" hint="« En attente » : non encore débité (exclu du solde comptable).">
              <Select id="tx-status" {...register("status")}>
                <option value="booked">Comptabilisée</option>
                <option value="pending">En attente</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Note (facultatif)" htmlFor="tx-desc">
            <Textarea id="tx-desc" rows={2} {...register("description")} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>{initial ? "Enregistrer" : "Ajouter"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
