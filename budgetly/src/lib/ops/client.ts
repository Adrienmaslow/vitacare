"use client";
/**
 * Exécuteur côté navigateur.
 *  - Mode « live »  : POST /api/ops/[name] (authentification et RLS côté serveur).
 *  - Mode « demo »  : exécution locale sur un LocalStore persistant dans le navigateur
 *                     du visiteur (aucune donnée envoyée au serveur, isolation totale).
 */
import type { LocalStore } from "@/lib/data/local-store";
import { DEMO_COOKIE } from "@/lib/supabase/config";
import type { OpResult } from "./execute";
import type { OpInput, OpName, OpOutput } from "./registry";

export const DEMO_STORAGE_KEY = "budgetly-demo-v1";

export class OpError extends Error {
  constructor(public readonly code: string, message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = "OpError";
  }
}

export function getMode(): "demo" | "live" {
  if (typeof document === "undefined") return "live";
  return document.cookie.split("; ").some((c) => c === `${DEMO_COOKIE}=demo`) ? "demo" : "live";
}

export function setDemoCookie(on: boolean) {
  document.cookie = on
    ? `${DEMO_COOKIE}=demo; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    : `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

let demoStore: Promise<LocalStore> | null = null;

function todayParis() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

async function loadDemoStore(): Promise<LocalStore> {
  const [{ LocalStore }, { createDemoData, DEMO_USER_ID }] = await Promise.all([import("@/lib/data/local-store"), import("@/features/demo/seed")]);
  let data = null;
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { day: string; data: unknown };
      // Les données sont régénérées chaque jour pour rester cohérentes avec la date du jour.
      if (parsed.day === todayParis()) data = parsed.data as import("@/lib/data/local-store").LocalData;
    }
  } catch {
    data = null;
  }
  data ??= await createDemoData(todayParis());
  const persist = (d: unknown) => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ day: todayParis(), data: d }));
    } catch {
      // Stockage indisponible (navigation privée) : la démo fonctionne en mémoire.
    }
  };
  persist(data);
  return new LocalStore(DEMO_USER_ID, data, persist);
}

export async function resetDemo() {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    /* ignoré */
  }
  demoStore = null;
}

export async function callOp<N extends OpName>(name: N, input?: OpInput<N>): Promise<OpOutput<N>> {
  if (getMode() === "demo") {
    demoStore ??= loadDemoStore();
    const store = await demoStore;
    const [{ executeOp }, { DemoOpportunityProvider }] = await Promise.all([import("./execute"), import("@/features/earn/providers/demo")]);
    const now = new Date();
    const result = await executeOp(
      { store, today: todayParis(), now, mode: "demo", opportunityProviders: [new DemoOpportunityProvider(todayParis())], coachAI: null },
      name,
      input ?? {},
    );
    if (!result.ok) throw new OpError(result.error.code, result.error.message, result.error.fields);
    return result.data;
  }
  let res: Response;
  try {
    res = await fetch(`/api/ops/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? {}), credentials: "same-origin" });
  } catch {
    throw new OpError("network", "Connexion impossible. Vérifie ton accès à Internet.");
  }
  const json = (await res.json().catch(() => null)) as OpResult<OpOutput<N>> | null;
  if (!json) throw new OpError("internal", "Réponse inattendue du serveur");
  if (!json.ok) {
    if (json.error.code === "unauthenticated" && typeof window !== "undefined") window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new OpError(json.error.code, json.error.message, json.error.fields);
  }
  return json.data;
}
