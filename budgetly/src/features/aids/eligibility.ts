/**
 * Estimation d'éligibilité — jamais une décision.
 *   - "potential"    : toutes les conditions connues sont remplies ;
 *   - "unknown"      : au moins une information manque ;
 *   - "unlikely"     : au moins une condition connue n'est pas remplie.
 */
import type { Aid, EligibilityFacts } from "@/data/aids";
import type { ProfileRow } from "@/types/db";

export type EligibilityStatus = "potential" | "unknown" | "unlikely";

export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  potential: "Potentiellement éligible",
  unknown: "Informations insuffisantes",
  unlikely: "Probablement non éligible selon les critères connus",
};

export interface EligibilityResult {
  status: EligibilityStatus;
  met: string[];
  unmet: string[];
  missing: string[];
}

export function factsFromProfile(p: ProfileRow | null): EligibilityFacts {
  if (!p) return {};
  return {
    status: p.status, ageRange: p.age_range, housing: p.housing, hasScholarship: p.has_scholarship,
    hasProfessionalIncome: p.has_professional_income, monthlyIncomeMinor: p.monthly_income_minor,
    receivesHousingAid: p.receives_housing_aid,
  };
}

export function evaluateAid(aid: Aid, facts: EligibilityFacts): EligibilityResult {
  const met: string[] = [], unmet: string[] = [], missing: string[] = [];
  for (const r of aid.rules) {
    const v = r.test(facts);
    (v === true ? met : v === false ? unmet : missing).push(r.label);
  }
  if (aid.isTool) return { status: "unknown", met, unmet, missing };
  const status: EligibilityStatus = unmet.length ? "unlikely" : missing.length ? "unknown" : "potential";
  return { status, met, unmet, missing };
}
