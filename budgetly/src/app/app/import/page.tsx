"use client";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Undo2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form-controls";
import { Badge, Notice } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { callOp, OpError } from "@/lib/ops/client";
import { decodeCsv, detectMapping, looksLikeCsv, MAX_CSV_BYTES, normalizeRows, parseCsv, type ColumnMapping, type ParsedCsv } from "@/features/imports/csv";
import { fmt } from "@/lib/dates";
import type { OpOutput } from "@/lib/ops/registry";

type Step = "select" | "mapping" | "review" | "done";
type Analyzed = OpOutput<"imports.analyze">;
const DUP_LABEL = { exact: "Doublon exact", probable: "Doublon probable", in_file: "Répété dans le fichier" } as const;

export default function ImportPage() {
  const accounts = useOp("accounts.list", { includeArchived: false });
  const history = useOp("imports.list", {});
  const revert = useMutationOp("imports.revert", { success: (d) => `${d.removed} opération(s) retirée(s)` });
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; encoding: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [accountId, setAccountId] = useState("");
  const [analysis, setAnalysis] = useState<Analyzed | null>(null);
  const [errorsCount, setErrorsCount] = useState(0);
  const [rowErrors, setRowErrors] = useState<{ line: number; reason: string }[]>([]);
  const [choices, setChoices] = useState<Record<number, { include: boolean; category_id: string | null }>>({});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OpOutput<"imports.commit"> | null>(null);

  const account = accountId || accounts.data?.accounts.find((a) => a.type === "checking")?.id || accounts.data?.accounts[0]?.id || "";

  const onFile = async (f: File) => {
    setError(null);
    if (f.size > MAX_CSV_BYTES) return setError("Fichier trop volumineux (2 Mo maximum).");
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) return setError("Format non pris en charge : choisis un fichier .csv exporté depuis ta banque.");
    const { text, encoding } = decodeCsv(new Uint8Array(await f.arrayBuffer()));
    if (!looksLikeCsv(text)) return setError("Ce fichier ne ressemble pas à un relevé CSV (au moins deux lignes avec séparateurs).");
    const p = parseCsv(text);
    if (!p.rows.length) return setError("Aucune ligne de données trouvée.");
    setFile({ name: f.name, encoding });
    setParsed(p);
    setMapping(detectMapping(p) ?? { date: 0, label: 1, amount: 2, dateFormat: "dmy" });
    setStep("mapping");
  };

  const preview = useMemo(() => (parsed && mapping ? normalizeRows(parsed, mapping, account) : null), [parsed, mapping, account]);

  const analyze = async () => {
    if (!preview || !preview.rows.length) return setError("Aucune ligne valide avec cette association de colonnes.");
    setBusy(true);
    setError(null);
    try {
      const a = await callOp("imports.analyze", { account_id: account, rows: preview.rows.map(({ dedupHash: _h, ...r }) => r) });
      setAnalysis(a);
      setErrorsCount(preview.errors.length);
      setRowErrors(preview.errors.slice(0, 20));
      setChoices(Object.fromEntries(a.rows.map((r) => [r.line, { include: r.duplicate === null || r.duplicate === "probable" ? r.duplicate === null : false, category_id: r.categorization.categoryId }])));
      setStep("review");
    } catch (e) {
      setError(e instanceof OpError ? e.message : "Analyse impossible");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!analysis || !file || !parsed) return;
    setBusy(true);
    try {
      const r = await callOp("imports.commit", {
        account_id: account, filename: file.name, totalRows: parsed.rows.length, errorCount: errorsCount, rememberRules: remember,
        rows: analysis.rows.map((row) => ({ line: row.line, date: row.date, bookingDate: row.bookingDate, label: row.label, type: row.type, amount_minor: row.amount_minor, include: choices[row.line]?.include ?? false, category_id: choices[row.line]?.category_id ?? null })),
      });
      setResult(r);
      setStep("done");
      history.refetch();
    } catch (e) {
      setError(e instanceof OpError ? e.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setStep("select"); setParsed(null); setAnalysis(null); setResult(null); setError(null); if (fileRef.current) fileRef.current.value = ""; };
  const included = analysis ? analysis.rows.filter((r) => choices[r.line]?.include).length : 0;
  const colOptions = parsed?.headers.map((h, i) => <option key={i} value={i}>{h}</option>);
  const steps: [Step, string][] = [["select", "Fichier"], ["mapping", "Colonnes"], ["review", "Vérification"], ["done", "Résumé"]];

  return (
    <>
      <PageHeader title="Importer un relevé CSV" description="Le fichier est lu dans ton navigateur et n'est jamais stocké : seules les opérations validées sont enregistrées." />
      <ol className="mb-5 flex flex-wrap gap-2 text-sm" aria-label="Étapes de l'import">
        {steps.map(([s, l], i) => <li key={s} aria-current={step === s ? "step" : undefined} className={`rounded-full px-3 py-1 font-medium ${step === s ? "bg-brand text-white dark:text-night" : "bg-surface-2 text-muted"}`}>{i + 1}. {l}</li>)}
      </ol>
      {error ? <div role="alert" className="mb-4 flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger"><AlertTriangle className="size-4" />{error}</div> : null}

      {step === "select" ? (
        <Card className="p-6">
          <label htmlFor="csv-file" className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-12 text-center transition hover:border-brand hover:bg-brand-soft/40"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
            <span className="rounded-2xl bg-brand-soft p-3 text-brand"><Upload className="size-6" /></span>
            <span className="font-semibold">Glisse ton fichier ici ou clique pour le choisir</span>
            <span className="text-sm text-muted">CSV avec virgule ou point-virgule, UTF-8 ou Windows-1252, dates JJ/MM/AAAA, montants « 12,50 », débit/crédit séparés acceptés. 2 Mo max.</span>
          </label>
          <input id="csv-file" ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <p className="mt-4 text-center text-sm text-muted">Pas de fichier sous la main ? <a className="font-semibold text-brand" href="/demo/releve-exemple.csv" download>Télécharger un relevé d'exemple</a></p>
        </Card>
      ) : null}

      {step === "mapping" && parsed && mapping ? (
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-brand" />{file?.name}</CardTitle><p className="mt-1 text-sm text-muted">{parsed.rows.length} lignes · séparateur « {parsed.delimiter === "\t" ? "tabulation" : parsed.delimiter} » · encodage {file?.encoding} · colonnes détectées automatiquement, à vérifier.</p></div></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Compte de destination" htmlFor="m-acc"><Select id="m-acc" value={account} onChange={(e) => setAccountId(e.target.value)}>{accounts.data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="Colonne date" htmlFor="m-date"><Select id="m-date" value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: Number(e.target.value) })}>{colOptions}</Select></Field>
              <Field label="Format de date" htmlFor="m-fmt"><Select id="m-fmt" value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as ColumnMapping["dateFormat"] })}><option value="dmy">JJ/MM/AAAA</option><option value="ymd">AAAA-MM-JJ</option><option value="mdy">MM/JJ/AAAA</option></Select></Field>
              <Field label="Colonne libellé" htmlFor="m-label"><Select id="m-label" value={mapping.label} onChange={(e) => setMapping({ ...mapping, label: Number(e.target.value) })}>{colOptions}</Select></Field>
              <Field label="Montants" htmlFor="m-mode"><Select id="m-mode" value={mapping.amount !== undefined ? "single" : "split"} onChange={(e) => setMapping(e.target.value === "single" ? { ...mapping, amount: mapping.debit ?? 0, debit: undefined, credit: undefined } : { ...mapping, amount: undefined, debit: mapping.amount ?? 0, credit: (mapping.amount ?? 0) + 1 })}><option value="single">Une colonne signée</option><option value="split">Débit / crédit séparés</option></Select></Field>
              {mapping.amount !== undefined ? (
                <>
                  <Field label="Colonne montant" htmlFor="m-amount"><Select id="m-amount" value={mapping.amount} onChange={(e) => setMapping({ ...mapping, amount: Number(e.target.value) })}>{colOptions}</Select></Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="accent-[#7357F6]" checked={!!mapping.invertSign} onChange={(e) => setMapping({ ...mapping, invertSign: e.target.checked })} /> Les dépenses sont en positif</label>
                </>
              ) : (
                <>
                  <Field label="Colonne débit" htmlFor="m-debit"><Select id="m-debit" value={mapping.debit} onChange={(e) => setMapping({ ...mapping, debit: Number(e.target.value) })}>{colOptions}</Select></Field>
                  <Field label="Colonne crédit" htmlFor="m-credit"><Select id="m-credit" value={mapping.credit} onChange={(e) => setMapping({ ...mapping, credit: Number(e.target.value) })}>{colOptions}</Select></Field>
                </>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Aperçu ({preview?.rows.length ?? 0} lignes valides, {preview?.errors.length ?? 0} ignorées)</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2 text-right">Montant</th></tr></thead>
                  <tbody className="divide-y divide-border">{preview?.rows.slice(0, 6).map((r) => <tr key={r.line}><td className="px-3 py-2">{fmt.day(r.date)}</td><td className="max-w-xs truncate px-3 py-2">{r.label}</td><td className="px-3 py-2 text-right"><Money value={r.type === "income" ? r.amount_minor : -r.amount_minor} sign colored /></td></tr>)}</tbody>
                </table>
              </div>
              {preview?.errors.length ? <p className="mt-2 text-xs text-warning">Lignes ignorées : {preview.errors.slice(0, 5).map((e) => `ligne ${e.line} (${e.reason})`).join(", ")}{preview.errors.length > 5 ? "…" : ""}</p> : null}
            </div>
            <div className="flex justify-between gap-2"><Button variant="ghost" onClick={reset}>Changer de fichier</Button><Button onClick={analyze} disabled={busy || !account || !preview?.rows.length}>{busy ? "Analyse…" : "Analyser les opérations"}</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" && analysis ? (
        <Card>
          <CardHeader className="flex-wrap"><div><CardTitle>Vérifie avant d'importer</CardTitle><p className="mt-1 text-sm text-muted">Les doublons exacts sont décochés et seront toujours écartés. Corrige les catégories si besoin.</p></div>
            <div className="flex gap-2 text-xs"><Badge tone="danger">{analysis.rows.filter((r) => r.duplicate === "exact").length} doublons exacts</Badge><Badge tone="warning">{analysis.rows.filter((r) => r.duplicate === "probable" || r.duplicate === "in_file").length} à vérifier</Badge><Badge tone="neutral">{analysis.rows.filter((r) => !r.categorization.categoryId).length} sans catégorie</Badge></div>
          </CardHeader>
          <CardContent>
            {rowErrors.length ? <Notice tone="warning" icon={AlertTriangle} className="mb-3">{errorsCount} ligne(s) invalide(s) ignorée(s) : {rowErrors.slice(0, 4).map((e) => `l.${e.line} ${e.reason.toLowerCase()}`).join(", ")}.</Notice> : null}
            <div className="max-h-[480px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted"><tr><th className="px-3 py-2">Importer</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Libellé</th><th className="px-3 py-2">Catégorie proposée</th><th className="px-3 py-2 text-right">Montant</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {analysis.rows.map((r) => {
                    const c = choices[r.line]!;
                    const cats = analysis.categories.filter((x) => x.kind === "both" || x.kind === r.type);
                    return (
                      <tr key={r.line} className={r.duplicate === "exact" ? "opacity-60" : ""}>
                        <td className="px-3 py-2"><input type="checkbox" aria-label={`Importer ${r.label}`} className="size-4 accent-[#7357F6]" disabled={r.duplicate === "exact"} checked={c.include} onChange={(e) => setChoices({ ...choices, [r.line]: { ...c, include: e.target.checked } })} /></td>
                        <td className="whitespace-nowrap px-3 py-2">{fmt.day(r.date)}</td>
                        <td className="max-w-[240px] px-3 py-2"><p className="truncate">{r.label}</p>{r.duplicate ? <Badge tone={r.duplicate === "exact" ? "danger" : "warning"}>{DUP_LABEL[r.duplicate]}</Badge> : null}</td>
                        <td className="px-3 py-2">
                          <Select aria-label={`Catégorie de ${r.label}`} className="h-8 text-xs" value={c.category_id ?? ""} onChange={(e) => setChoices({ ...choices, [r.line]: { ...c, category_id: e.target.value || null } })}>
                            <option value="">— À catégoriser —</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </Select>
                          <p className="mt-0.5 text-[11px] text-muted">{r.categorization.explanation}</p>
                        </td>
                        <td className="px-3 py-2 text-right"><Money value={r.type === "income" ? r.amount_minor : -r.amount_minor} sign colored /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#7357F6]" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Mémoriser mes catégories comme règles pour les prochains imports</label>
            <div className="mt-4 flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep("mapping")}>Retour</Button><Button onClick={commit} disabled={busy || !included}>{busy ? "Import…" : `Importer ${included} opération(s)`}</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" && result ? (
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-positive" />
          <h2 className="mt-3 text-xl font-bold">{result.imported} opération(s) importée(s)</h2>
          <p className="mt-1 text-sm text-muted">{result.skippedDuplicates ? `${result.skippedDuplicates} doublon(s) écarté(s) automatiquement. ` : ""}Tu peux annuler cet import à tout moment depuis l'historique ci-dessous.</p>
          <div className="mt-4 flex justify-center gap-2"><Button asChild><Link href="/app/transactions">Voir les opérations</Link></Button><Button variant="outline" onClick={reset}>Nouvel import</Button></div>
        </Card>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Historique des imports</h2>
        {history.data?.length ? (
          <div className="grid gap-2">
            {history.data.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span><strong>{h.filename}</strong> · {fmt.full(h.created_at.slice(0, 10))} · {h.imported_count} importée(s), {h.duplicate_count} non importée(s), {h.error_count} erreur(s)</span>
                {h.status === "reverted" ? <Badge>Annulé</Badge> : <Button size="sm" variant="ghost" onClick={() => revert.mutate({ id: h.id })} disabled={revert.isPending}><Undo2 /> Annuler l'import</Button>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">Aucun import pour l'instant.</p>}
      </section>
    </>
  );
}
