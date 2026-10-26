"use client";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Search, Tags, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { TransactionFormDialog } from "@/components/forms/transaction-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { Badge, EmptyState, ErrorState, Modal, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { callOp } from "@/lib/ops/client";
import { fmt } from "@/lib/dates";
import { downloadText, toCsv } from "@/lib/utils";
import type { TransactionRow } from "@/types/db";

function TransactionsContent() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [accountId, setAccountId] = useState(params.get("account") ?? "");
  const [categoryId, setCategoryId] = useState(params.get("category") ?? (params.get("uncategorized") ? "none" : ""));
  const [type, setType] = useState("");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkCat, setBulkCat] = useState("");
  const [remember, setRemember] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sort = (sorting[0]?.id ?? "date") as "date" | "amount_minor" | "label";
  const filters = {
    q: q || undefined, accountId: accountId || undefined, categoryId: categoryId || undefined,
    type: (type || undefined) as "income" | "expense" | "transfer" | undefined, from: from || undefined, to: to || undefined,
  };
  const list = useOp("transactions.list", { ...filters, page, pageSize, sort, desc: sorting[0]?.desc ?? true }, { placeholderData: (p) => p });
  const bulk = useMutationOp("transactions.bulk", { success: (d) => `${d.affected} opération(s) mises à jour` });

  const cats = useMemo(() => new Map((list.data?.categories ?? []).map((c) => [c.id, c])), [list.data]);
  const accounts = useMemo(() => new Map((list.data?.accounts ?? []).map((a) => [a.id, a])), [list.data]);

  const columns = useMemo<ColumnDef<TransactionRow>[]>(() => [
    {
      id: "select",
      header: ({ table }) => <input type="checkbox" aria-label="Tout sélectionner" className="size-4 accent-[#7357F6]" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} />,
      cell: ({ row }) => <input type="checkbox" aria-label={`Sélectionner ${row.original.label}`} className="size-4 accent-[#7357F6]" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
    },
    { id: "date", header: "Date", enableSorting: true, cell: ({ row }) => <span className="whitespace-nowrap text-muted">{fmt.day(row.original.date)}</span> },
    {
      id: "label", header: "Libellé", enableSorting: true,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.label}</p>
          <p className="truncate text-xs text-muted">{accounts.get(row.original.account_id)?.name}{row.original.status === "pending" ? " · en attente" : ""}{row.original.source === "csv" ? " · import CSV" : row.original.source === "recurring" ? " · échéance" : ""}</p>
        </div>
      ),
    },
    {
      id: "category", header: "Catégorie",
      cell: ({ row }) => {
        const t = row.original;
        if (t.type.startsWith("transfer")) return <Badge tone="brand">Transfert</Badge>;
        const c = t.category_id ? cats.get(t.category_id) : null;
        return c ? <span className="inline-flex items-center gap-1.5 text-sm"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}</span> : <Badge tone="warning">À catégoriser</Badge>;
      },
    },
    {
      id: "amount_minor", header: () => <span className="block text-right">Montant</span>, enableSorting: true,
      cell: ({ row }) => { const t = row.original; const s = t.type === "income" || t.type === "transfer_in" ? t.amount_minor : -t.amount_minor; return <Money value={s} sign colored={!t.type.startsWith("transfer")} className="block text-right font-semibold" />; },
    },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${row.original.label}`} onClick={() => { setEditing(row.original); setFormOpen(true); }}><Pencil /></Button> },
  ], [cats, accounts]);

  const table = useReactTable({
    data: list.data?.rows ?? [], columns, getCoreRowModel: getCoreRowModel(), getRowId: (r) => r.id,
    manualSorting: true, manualPagination: true, enableSortingRemoval: false,
    state: { sorting, rowSelection: selection },
    onSortingChange: (u) => { setSorting(u); setPage(0); },
    onRowSelectionChange: setSelection,
    pageCount: list.data ? Math.ceil(list.data.total / pageSize) : -1,
  });
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); setSelection({}); };
  const hasFilters = q || accountId || categoryId || type || from || to;

  const exportCsv = async () => {
    const rows = await callOp("transactions.export", { ...filters, sort, desc: true });
    downloadText(`budgetly-operations-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((r) => ({ ...r, montant: (r.montant / 100).toFixed(2).replace(".", ",") }))));
  };

  return (
    <>
      <PageHeader title="Transactions" description="Recherche, filtre, catégorise et corrige tes opérations. Les transferts internes sont exclus des revenus et dépenses."
        actions={<><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Opération</Button><Button variant="outline" asChild><Link href="/app/import"><Upload /> Importer</Link></Button><Button variant="outline" onClick={exportCsv}><Download /> Exporter CSV</Button></>} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input aria-label="Rechercher un libellé" placeholder="Rechercher…" className="pl-9" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
          </div>
          <Select aria-label="Compte" value={accountId} onChange={(e) => resetPage(setAccountId)(e.target.value)}><option value="">Tous les comptes</option>{list.data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select aria-label="Catégorie" value={categoryId} onChange={(e) => resetPage(setCategoryId)(e.target.value)}><option value="">Toutes catégories</option><option value="none">Non catégorisées</option>{list.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select aria-label="Type" value={type} onChange={(e) => resetPage(setType)(e.target.value)}><option value="">Tous types</option><option value="expense">Dépenses</option><option value="income">Revenus</option><option value="transfer">Transferts</option></Select>
          <div className="flex gap-2"><Input type="date" aria-label="Depuis" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} /><Input type="date" aria-label="Jusqu'au" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} /></div>
        </div>
        {hasFilters ? <button className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand" onClick={() => { setQ(""); setAccountId(""); setCategoryId(""); setType(""); setFrom(""); setTo(""); setPage(0); }}><X className="size-3" /> Réinitialiser les filtres</button> : null}
      </Card>

      {selectedIds.length ? (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft p-3 text-sm lg:top-2">
          <strong>{selectedIds.length} sélectionnée(s)</strong>
          <Select aria-label="Catégorie à appliquer" className="h-8 w-48" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}><option value="">Catégoriser en…</option>{list.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-[#7357F6]" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Mémoriser la règle</label>
          <Button size="sm" disabled={!bulkCat} onClick={async () => { await bulk.mutateAsync({ action: "categorize", ids: selectedIds, category_id: bulkCat, rememberRule: remember }); setSelection({}); }}><Tags /> Appliquer</Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 /> Supprimer</Button>
        </div>
      ) : null}

      {list.isPending ? <Skeleton className="h-96" /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : !list.data.total ? (
        <EmptyState icon={Search} title={hasFilters ? "Aucun résultat" : "Aucune opération"} description={hasFilters ? "Modifie tes filtres pour élargir la recherche." : "Ajoute une opération ou importe un relevé CSV."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-4 border-b border-border px-4 py-3 text-sm">
            <span><strong className="tabular">{list.data.total}</strong> opération(s)</span>
            <span>Revenus : <Money value={list.data.sums.income} className="font-semibold text-positive" /></span>
            <span>Dépenses : <Money value={list.data.sums.expenses} className="font-semibold text-danger" /></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>{hg.headers.map((h) => (
                    <th key={h.id} className="px-4 py-2.5 font-semibold" aria-sort={h.column.getIsSorted() ? (h.column.getIsSorted() === "desc" ? "descending" : "ascending") : undefined}>
                      {h.column.getCanSort() ? (
                        <button className="inline-flex cursor-pointer items-center gap-1 uppercase" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : null}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}</tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className={r.getIsSelected() ? "bg-brand-soft/50" : "hover:bg-surface-2/60"}>
                    {r.getVisibleCells().map((c) => <td key={c.id} className="max-w-[320px] px-4 py-2.5">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
            <label className="flex items-center gap-2 text-muted">Par page <Select className="h-8 w-20" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>{[25, 50, 100].map((n) => <option key={n}>{n}</option>)}</Select></label>
            <div className="flex items-center gap-2">
              <span className="text-muted">Page {page + 1} / {Math.max(1, Math.ceil(list.data.total / pageSize))}</span>
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= list.data.total} onClick={() => setPage(page + 1)}>Suivant</Button>
            </div>
          </div>
        </Card>
      )}

      <TransactionFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
      <Modal open={confirmDelete} onOpenChange={setConfirmDelete} title={`Supprimer ${selectedIds.length} opération(s) ?`} description="Les deux jambes d'un transfert sont supprimées ensemble. Cette action est irréversible."
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button><Button variant="danger" onClick={async () => { await bulk.mutateAsync({ action: "delete", ids: selectedIds }); setSelection({}); setConfirmDelete(false); }}>Supprimer</Button></>}>
        <span />
      </Modal>
    </>
  );
}

export default function TransactionsPage() {
  return <Suspense><TransactionsContent /></Suspense>;
}
