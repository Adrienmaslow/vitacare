import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold">Mentions légales</h1>
      <p className="mt-4 rounded-2xl bg-warning-soft p-4 text-sm">Page à compléter avant toute mise en ligne publique : les informations ci-dessous sont des emplacements réservés.</p>
      <dl className="mt-8 grid gap-4 text-sm">
        {[["Éditeur", "[Nom / raison sociale, adresse, e-mail de contact]"], ["Directeur de la publication", "[Nom]"], ["Hébergement", "[Hébergeur de l'application, adresse] — [Hébergeur de la base de données, région]"], ["Projet", "BUDGETLY — projet étudiant (2026)"]].map(([k, v]) => (
          <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>
        ))}
      </dl>
      <h2 className="mt-10 text-xl font-semibold">Avertissement</h2>
      <p className="mt-2 text-sm text-muted">BUDGETLY est un outil d'aide à la gestion budgétaire. Il ne constitue ni un établissement bancaire, ni un service de conseil en investissement, ni un organisme d'attribution d'aides. Les informations relatives aux aides, offres d'emploi et bons plans sont fournies à titre indicatif avec leur source ; seuls les organismes et sites officiels font foi.</p>
    </main>
  );
}
