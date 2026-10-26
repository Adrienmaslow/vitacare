/** Schémas Zod réutilisables. */
import { z } from "zod";
import { isValidISODate } from "./dates";
import { MAX_AMOUNT_MINOR } from "./money";

export const uuid = z.string().uuid();
export const isoDate = z.string().refine(isValidISODate, "Date invalide (AAAA-MM-JJ)");
export const monthStart = isoDate.refine((d) => d.endsWith("-01"), "Le mois doit commencer le 1er");
export const amountMinor = z.number().int("Montant en centimes entier").min(1, "Le montant doit être positif").max(MAX_AMOUNT_MINOR);
export const signedMinor = z.number().int().min(-MAX_AMOUNT_MINOR).max(MAX_AMOUNT_MINOR);
export const nonNegMinor = z.number().int().min(0).max(MAX_AMOUNT_MINOR);
export const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide");
export const frequency = z.enum(["weekly", "monthly", "quarterly", "yearly"]);
export const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
export const currency = z.literal("EUR").default("EUR");
