/** Modèle d'opportunité commun à tous les fournisseurs. */
export interface Opportunity {
  provider: string;
  externalId: string;
  /** true = exemple de démonstration, jamais une vraie offre. */
  isExample: boolean;
  title: string;
  employer: string | null;
  location: string | null;
  remote: boolean;
  category: string;
  contractType: string | null;
  postedAt: string | null;
  startDate: string | null;
  durationLabel: string | null;
  durationHours: number | null;
  payLabel: string | null;
  hourlyRateMinor: number | null;
  description: string;
  skills: string[];
  url: string | null;
  sourceName: string;
  fetchedAt: string;
  weekend: boolean | null;
}

export interface OpportunityQuery {
  keywords?: string;
  location?: string;
  radiusKm?: number;
  remote?: boolean;
  category?: string;
  minHourlyMinor?: number;
  contractType?: string;
  page?: number;
}

export interface OpportunityProvider {
  readonly id: string;
  readonly name: string;
  /** true si l'adaptateur est configuré et utilisable. */
  isEnabled(): boolean;
  search(q: OpportunityQuery): Promise<Opportunity[]>;
}
