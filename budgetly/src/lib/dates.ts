/**
 * Dates calendaires sans fuseau : toutes les dates métier sont des chaînes
 * AAAA-MM-JJ manipulées en UTC pour éviter les décalages d'heure d'été.
 */
import type { Frequency, ISODate } from "@/types/db";

const DAY_MS = 86_400_000;

export function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Date du jour dans le fuseau donné (par défaut Europe/Paris). */
export function today(timeZone = "Europe/Paris", now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA → AAAA-MM-JJ
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toDate(s);
  return !Number.isNaN(d.getTime()) && fromDate(d) === s;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDate(new Date(toDate(iso).getTime() + days * DAY_MS));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

export function daysInMonth(iso: ISODate): number {
  const d = toDate(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Ajoute des mois en bornant au dernier jour du mois (31 janv. + 1 mois = 28/29 févr.). */
export function addMonths(iso: ISODate, months: number, anchorDay?: number): ISODate {
  const d = toDate(iso);
  const day = anchorDay ?? d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return fromDate(target);
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

/** Lundi de la semaine ISO contenant la date. */
export function startOfWeek(iso: ISODate): ISODate {
  const dow = toDate(iso).getUTCDay(); // 0 = dimanche
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function isBetween(iso: ISODate, from: ISODate, to: ISODate): boolean {
  return iso >= from && iso <= to;
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Occurrence suivante d'une fréquence, ancrée sur le jour de départ pour les mois. */
export function nextOccurrence(iso: ISODate, frequency: Frequency, anchorDay?: number): ISODate {
  switch (frequency) {
    case "weekly":
      return addDays(iso, 7);
    case "monthly":
      return addMonths(iso, 1, anchorDay);
    case "quarterly":
      return addMonths(iso, 3, anchorDay);
    case "yearly":
      return addMonths(iso, 12, anchorDay);
  }
}

/** Toutes les occurrences d'une échéance entre from et to (inclus), à partir de start. */
export function occurrencesBetween(
  start: ISODate,
  frequency: Frequency,
  from: ISODate,
  to: ISODate,
  end?: ISODate | null,
  maxCount = 1000,
): ISODate[] {
  const anchor = toDate(start).getUTCDate();
  const out: ISODate[] = [];
  let d = start;
  let guard = 0;
  while (d <= to && guard++ < maxCount * 10) {
    if (end && d > end) break;
    if (d >= from) {
      out.push(d);
      if (out.length >= maxCount) break;
    }
    d = nextOccurrence(d, frequency, anchor);
  }
  return out;
}

/** Nombre d'occurrences par an (pour les équivalents mensuels/annuels). */
export const OCCURRENCES_PER_YEAR: Record<Frequency, number> = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const fullFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const fmt = {
  month: (iso: ISODate) => monthFmt.format(toDate(iso)),
  shortMonth: (iso: ISODate) => shortMonthFmt.format(toDate(iso)).replace(".", ""),
  day: (iso: ISODate) => dayFmt.format(toDate(iso)),
  longDay: (iso: ISODate) => longDayFmt.format(toDate(iso)),
  full: (iso: ISODate) => fullFmt.format(toDate(iso)),
};
