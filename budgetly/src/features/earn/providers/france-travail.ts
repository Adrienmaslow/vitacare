/**
 * Adaptateur France Travail — API « Offres d'emploi v2 » (francetravail.io).
 * Activation : FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET (accès partenaire requis).
 * Module SERVEUR UNIQUEMENT : le secret ne doit jamais atteindre le navigateur.
 * Statut : implémenté d'après la documentation publique, non testé contre l'API réelle
 * (aucun identifiant disponible lors du développement) — voir docs/EXTERNAL_PROVIDERS.md.
 */
import "server-only";
import type { Opportunity, OpportunityProvider, OpportunityQuery } from "../types";

const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

let cachedToken: { value: string; expiresAt: number } | null = null;

interface FTOffer {
  id: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string };
  typeContrat?: string;
  typeContratLibelle?: string;
  dureeTravailLibelle?: string;
  salaire?: { libelle?: string };
  competences?: { libelle?: string }[];
  origineOffre?: { urlOrigine?: string };
}

/** Extrait un taux horaire brut d'un libellé du type « Horaire de 11.88 Euros sur 12 mois ». */
export function parseHourlyRate(label: string | undefined): number | null {
  if (!label || !/horaire/i.test(label)) return null;
  const m = /(\d+)(?:[.,](\d{1,2}))?\s*euros?/i.exec(label);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export function mapOffer(o: FTOffer, fetchedAt: string): Opportunity {
  const desc = (o.description ?? "").slice(0, 1200);
  return {
    provider: "france-travail",
    externalId: o.id,
    isExample: false,
    title: o.intitule ?? "Offre sans titre",
    employer: o.entreprise?.nom ?? null,
    location: o.lieuTravail?.libelle ?? null,
    remote: /t[ée]l[ée]travail/i.test(desc),
    category: o.typeContrat === "MIS" ? "interim" : o.typeContrat === "SAI" ? "saisonnier" : "job_etudiant",
    contractType: o.typeContratLibelle ?? o.typeContrat ?? null,
    postedAt: o.dateCreation?.slice(0, 10) ?? null,
    startDate: null,
    durationLabel: o.dureeTravailLibelle ?? null,
    durationHours: null,
    payLabel: o.salaire?.libelle ?? null,
    hourlyRateMinor: parseHourlyRate(o.salaire?.libelle),
    description: desc,
    skills: (o.competences ?? []).map((c) => c.libelle ?? "").filter(Boolean).slice(0, 8),
    url: o.origineOffre?.urlOrigine?.startsWith("https://") ? o.origineOffre.urlOrigine : `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(o.id)}`,
    sourceName: "France Travail",
    fetchedAt,
    weekend: null,
  };
}

export class FranceTravailProvider implements OpportunityProvider {
  readonly id = "france-travail";
  readonly name = "France Travail";
  constructor(
    private readonly clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID,
    private readonly clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isEnabled() {
    return !!this.clientId && !!this.clientSecret;
  }

  private async token(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: this.clientId!, client_secret: this.clientSecret!, scope: SCOPE });
    const res = await this.fetchImpl(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`France Travail : authentification refusée (${res.status})`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  async search(q: OpportunityQuery): Promise<Opportunity[]> {
    if (!this.isEnabled()) return [];
    const params = new URLSearchParams();
    params.set("motsCles", (q.keywords?.trim() || "étudiant").slice(0, 80));
    // Département (2-3 caractères) accepté ; les codes commune INSEE nécessitent un référentiel.
    if (q.location && /^\d{2,3}$|^2[AB]$/.test(q.location.trim())) params.set("departement", q.location.trim());
    if (q.contractType) params.set("typeContrat", q.contractType);
    const page = Math.max(0, q.page ?? 0);
    params.set("range", `${page * 20}-${page * 20 + 19}`);
    const res = await this.fetchImpl(`${SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${await this.token()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`France Travail : recherche indisponible (${res.status})`);
    const json = (await res.json()) as { resultats?: FTOffer[] };
    const fetchedAt = new Date().toISOString();
    return (json.resultats ?? []).map((o) => mapOffer(o, fetchedAt));
  }
}
