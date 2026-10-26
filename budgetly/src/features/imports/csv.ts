/**
 * Moteur d'import de relevés CSV.
 * Étapes : décodage → détection du séparateur → détection des colonnes →
 * normalisation (dates, montants) → déduplication → catégorisation.
 * Les fichiers bruts ne sont jamais stockés ; seules les lignes validées sont importées.
 */
import Papa from "papaparse";
import { isValidISODate } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import type { ISODate, Minor, TransactionRow } from "@/types/db";
import { normalizeLabel } from "../transactions/categorize";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

/** Décode un fichier en essayant UTF-8 strict, puis Windows-1252 (exports bancaires français). */
export function decodeCsv(bytes: Uint8Array): { text: string; encoding: "utf-8" | "windows-1252" } {
  let data = bytes;
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) data = data.subarray(3);
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(data), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(data), encoding: "windows-1252" };
  }
}

/** Rejette les contenus manifestement non tabulaires (binaire, HTML…). */
export function looksLikeCsv(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (/\u0000/.test(sample)) return false;
  if (/^\s*<(!doctype|html|\?xml)/i.test(sample)) return false;
  const lines = sample.split(/\r?\n/).filter((l) => l.trim());
  return lines.length >= 2 && lines.slice(0, 5).some((l) => /[;,\t|]/.test(l));
}

export function detectDelimiter(text: string): ";" | "," | "\t" | "|" {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  const candidates = [";", ",", "\t", "|"] as const;
  let best: (typeof candidates)[number] = ";";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const min = Math.min(...counts);
    const consistent = counts.every((c) => c === counts[0]);
    const score = min * (consistent ? 2 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
}

export function parseCsv(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text);
  const result = Papa.parse<string[]>(text.trim(), { delimiter, skipEmptyLines: "greedy" });
  let rows = (result.data as string[][]).map((r) => r.map((c) => (c ?? "").trim()));
  // Certains exports commencent par des lignes d'en-tête de banque : on garde le bloc le plus large.
  const width = Math.max(...rows.map((r) => r.length));
  const firstFull = rows.findIndex((r) => r.length === width);
  rows = rows.slice(Math.max(0, firstFull)).filter((r) => r.length === width);
  const first = rows[0] ?? [];
  const hasHeader = first.length > 0 && first.every((c) => parseAmount(c) === null || c === "") && first.some((c) => /[a-zA-ZÀ-ÿ]/.test(c));
  const headers = hasHeader ? first.map((h, i) => h || `Colonne ${i + 1}`) : first.map((_, i) => `Colonne ${i + 1}`);
  return { delimiter, headers, rows: (hasHeader ? rows.slice(1) : rows).slice(0, MAX_CSV_ROWS), hasHeader };
}

export interface ColumnMapping {
  date: number;
  label: number;
  /** Montant signé unique… */
  amount?: number;
  /** …ou colonnes débit / crédit séparées. */
  debit?: number;
  credit?: number;
  bookingDate?: number;
  /** Format des dates. */
  dateFormat: "dmy" | "ymd" | "mdy";
  /** Si les débits sont exprimés en positif dans la colonne montant (rare). */
  invertSign?: boolean;
}

const H = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function detectMapping(parsed: ParsedCsv): ColumnMapping | null {
  const h = parsed.headers.map(H);
  const find = (re: RegExp) => h.findIndex((x) => re.test(x));
  let date = find(/^date( (d'?)?operation|op)?$|date operation|^date$|^jour/);
  if (date < 0) date = find(/date/);
  const booking = find(/date (de )?valeur|date comptable|date de comptabilisation/);
  const findExcept = (re: RegExp, except: number[]) => h.findIndex((x, i) => !except.includes(i) && re.test(x));
  let label = findExcept(/libelle|description|intitule|label/, [date, booking]);
  if (label < 0) label = findExcept(/detail|operation|nature|beneficiaire/, [date, booking]);
  const debit = find(/^debit|debit$|sortie|montant debit/);
  const credit = find(/^credit|credit$|entree|montant credit/);
  const amount = find(/^montant|amount|^somme|valeur$|montant \(eur\)|^eur$/);

  const sample = parsed.rows.slice(0, 20);
  // Repli sans en-tête : déduction par contenu.
  if (date < 0) date = parsed.headers.findIndex((_, i) => sample.length > 0 && sample.every((r) => parseDate(r[i] ?? "", "dmy") || parseDate(r[i] ?? "", "ymd")));
  if (label < 0) {
    let bestLen = 0;
    parsed.headers.forEach((_, i) => {
      if (i === date) return;
      const avg = sample.reduce((s, r) => s + ((r[i] ?? "").replace(/[\d\s,.-]/g, "").length), 0) / Math.max(1, sample.length);
      if (avg > bestLen) {
        bestLen = avg;
        label = i;
      }
    });
  }
  if (date < 0 || label < 0) return null;
  const dateFormat = detectDateFormat(sample.map((r) => r[date] ?? ""));
  const base: ColumnMapping = { date, label, dateFormat };
  if (booking >= 0 && booking !== date) base.bookingDate = booking;
  if (debit >= 0 && credit >= 0 && debit !== credit) return { ...base, debit, credit };
  if (amount >= 0) return { ...base, amount };
  const numeric = parsed.headers.findIndex((_, i) => i !== date && i !== label && sample.length > 0 && sample.every((r) => parseAmount(r[i] ?? "") !== null));
  return numeric >= 0 ? { ...base, amount: numeric } : null;
}

export function detectDateFormat(values: string[]): ColumnMapping["dateFormat"] {
  const v = values.filter(Boolean);
  if (v.length && v.every((x) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(x))) return "ymd";
  // Si un premier composant > 12 apparaît, c'est jour/mois ; sinon on suppose le format européen.
  if (v.some((x) => Number(x.split(/[-/.]/)[1]) > 12) && !v.some((x) => Number(x.split(/[-/.]/)[0]) > 12)) return "mdy";
  return "dmy";
}

export function parseDate(raw: string, format: ColumnMapping["dateFormat"]): ISODate | null {
  const s = raw.trim().slice(0, 10);
  const parts = s.split(/[-/.]/);
  if (parts.length !== 3) return null;
  const [a, b, c] = parts as [string, string, string];
  let y: string, m: string, d: string;
  if (format === "ymd") [y, m, d] = [a, b, c];
  else if (format === "mdy") [m, d, y] = [a, b, c];
  else [d, m, y] = [a, b, c];
  if (y.length === 2) y = `20${y}`;
  const iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : null;
}

/** Neutralise les formules (=, +, -, @, tabulation) pour éviter les injections CSV à la ré-exportation. */
export function sanitizeCell(value: string): string {
  const v = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return /^[=+\-@\t\r]/.test(v) && parseAmount(v) === null ? `'${v}` : v;
}

export interface NormalizedRow {
  line: number;
  date: ISODate;
  bookingDate: ISODate | null;
  label: string;
  type: "income" | "expense";
  amount_minor: Minor;
  dedupHash: string;
}

export interface RowError {
  line: number;
  reason: string;
  raw: string[];
}

export function dedupHash(accountId: string, date: ISODate, signed: Minor, label: string): string {
  return `${accountId}|${date}|${signed}|${normalizeLabel(label)}`;
}

export function normalizeRows(parsed: ParsedCsv, mapping: ColumnMapping, accountId: string): { rows: NormalizedRow[]; errors: RowError[] } {
  const rows: NormalizedRow[] = [];
  const errors: RowError[] = [];
  const offset = parsed.hasHeader ? 2 : 1;
  parsed.rows.forEach((r, i) => {
    const line = i + offset;
    const date = parseDate(r[mapping.date] ?? "", mapping.dateFormat);
    if (!date) return errors.push({ line, reason: "Date illisible", raw: r });
    const label = sanitizeCell(r[mapping.label] ?? "").slice(0, 200);
    if (!label) return errors.push({ line, reason: "Libellé vide", raw: r });
    let signed: Minor | null;
    if (mapping.amount !== undefined) {
      signed = parseAmount(r[mapping.amount] ?? "");
      if (signed !== null && mapping.invertSign) signed = -signed;
    } else {
      const debit = parseAmount(r[mapping.debit!] ?? "") ?? 0;
      const credit = parseAmount(r[mapping.credit!] ?? "") ?? 0;
      signed = (r[mapping.debit!] ?? "") === "" && (r[mapping.credit!] ?? "") === "" ? null : Math.abs(credit) - Math.abs(debit);
    }
    if (signed === null) return errors.push({ line, reason: "Montant illisible", raw: r });
    if (signed === 0) return errors.push({ line, reason: "Montant nul", raw: r });
    const bookingRaw = mapping.bookingDate !== undefined ? r[mapping.bookingDate] ?? "" : "";
    rows.push({
      line, date, label,
      bookingDate: bookingRaw ? parseDate(bookingRaw, mapping.dateFormat) : null,
      type: signed > 0 ? "income" : "expense",
      amount_minor: Math.abs(signed),
      dedupHash: dedupHash(accountId, date, signed, label),
    });
  });
  return { rows, errors };
}

export type DuplicateKind = "exact" | "probable" | "in_file" | null;

/**
 * Détection des doublons :
 *  - exact     : même compte, date, montant signé et libellé normalisé qu'une opération existante ;
 *  - probable  : même compte et montant, date à ±2 jours, libellés proches ;
 *  - in_file   : ligne identique déjà présente plus haut dans le fichier.
 */
export function detectDuplicates(rows: NormalizedRow[], existing: TransactionRow[], accountId: string): DuplicateKind[] {
  const existingOnAccount = existing.filter((t) => t.account_id === accountId && !t.type.startsWith("transfer"));
  const hashes = new Set(existingOnAccount.map((t) => t.dedup_hash ?? dedupHash(accountId, t.date, t.type === "income" ? t.amount_minor : -t.amount_minor, t.label)));
  const seen = new Map<string, number>();
  const existingCount = new Map<string, number>();
  for (const h of existingOnAccount.map((t) => t.dedup_hash ?? dedupHash(accountId, t.date, t.type === "income" ? t.amount_minor : -t.amount_minor, t.label))) {
    existingCount.set(h, (existingCount.get(h) ?? 0) + 1);
  }
  return rows.map((r) => {
    const n = (seen.get(r.dedupHash) ?? 0) + 1;
    seen.set(r.dedupHash, n);
    // Deux achats identiques le même jour sont possibles : on compare les occurrences.
    if (hashes.has(r.dedupHash) && n <= (existingCount.get(r.dedupHash) ?? 0)) return "exact";
    if (n > 1) return "in_file";
    const label = normalizeLabel(r.label);
    const probable = existingOnAccount.some((t) => {
      if (t.amount_minor !== r.amount_minor || (t.type === "income") !== (r.type === "income")) return false;
      const days = Math.abs((Date.parse(t.date) - Date.parse(r.date)) / 86_400_000);
      if (days > 2) return false;
      const other = normalizeLabel(t.label);
      const a = label.split(" ")[0] ?? "";
      return !!a && (other.includes(a) || label.includes(other.split(" ")[0] ?? "\u0000"));
    });
    return probable ? "probable" : null;
  });
}
