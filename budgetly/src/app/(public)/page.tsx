import type { Metadata } from "next";
import { ArrowRight, BadgeEuro, Bot, Briefcase, CalendarClock, ChartLine, Clock, Coins, Eye, GraduationCap, HandHeart, ListChecks, Lock, PiggyBank, Repeat, Server, ShieldCheck, Target, TrendingDown, TrendingUp, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { ProductPreview } from "@/components/landing/preview";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "BUDGETLY — Gère ton budget, découvre tes aides et tes opportunités",
  description: "Budget étudiant, prévisions de fin de mois, aides financières, bons plans et revenus complémentaires : BUDGETLY est le copilote financier des étudiants et jeunes actifs.",
  alternates: { canonical: "/" },
};

const PROBLEMS = [
  { icon: TrendingDown, title: "Revenus limités et irréguliers", text: "Job, bourse, aides, soutien familial : des montants qui varient et arrivent à des dates différentes." },
  { icon: CalendarClock, title: "Charges fixes lourdes", text: "Le loyer, le téléphone et les abonnements absorbent l'essentiel du budget avant même le 10 du mois." },
  { icon: Coins, title: "Imprévus et difficulté à épargner", text: "Une réparation ou un billet de train suffit à faire basculer le compte dans le rouge." },
  { icon: HandHeart, title: "Aides méconnues", text: "Beaucoup de jeunes ne demandent pas les aides auxquelles ils pourraient avoir droit." },
  { icon: Clock, title: "Peu de temps", text: "Entre les cours et le travail, chercher un job ou comparer des offres passe au second plan." },
];

const PILLARS = [
  { n: "01", title: "Comprendre", text: "Combien tu possèdes vraiment, où part ton argent, ce qui est fixe ou évitable." },
  { n: "02", title: "Anticiper", text: "Une prévision jour par jour qui détecte les risques de découvert avant qu'ils arrivent." },
  { n: "03", title: "Économiser", text: "Réductions étudiantes et comparaisons basées sur tes vraies dépenses." },
  { n: "04", title: "Gagner", text: "Des missions adaptées à tes disponibilités, avec le gain réel après frais." },
  { n: "05", title: "Agir", text: "Un plan de 3 à 5 actions concrètes par semaine, et le suivi des résultats." },
];

const FEATURES = [
  { icon: Wallet, title: "Multicomptes", text: "Courant, épargne, espèces : soldes calculés, transferts sans double comptage." },
  { icon: Upload, title: "Import CSV bancaire", text: "Détection des colonnes, doublons et catégorisation automatique. Réversible." },
  { icon: PiggyBank, title: "Budgets", text: "Plafonds par catégorie, alertes à 70/85/100 %, répartition suggérée." },
  { icon: TrendingUp, title: "Prévisions", text: "Trois scénarios, hypothèses visibles et fiabilité indicative." },
  { icon: ListChecks, title: "Plan d'action", text: "Recommandations explicables, priorisées et mesurées." },
  { icon: HandHeart, title: "Aides", text: "Estimation d'éligibilité prudente, liens officiels, suivi des démarches." },
  { icon: Briefcase, title: "Revenus complémentaires", text: "Score de compatibilité, candidatures, calcul de rentabilité." },
  { icon: Target, title: "Objectifs d'épargne", text: "Effort mensuel, date estimée et quatre stratégies réalistes." },
  { icon: Repeat, title: "Abonnements", text: "Coût annuel réel, renouvellements et alternatives." },
  { icon: Bot, title: "Coach", text: "Pose tes questions : réponses chiffrées à partir de tes données." },
  { icon: ChartLine, title: "Analyses", text: "Taux d'épargne, charges fixes, tendances et exports." },
  { icon: GraduationCap, title: "Vie quotidienne", text: "Courses, logement, transport, rentrée et culture financière." },
];

const FAQ = [
  ["BUDGETLY est-il gratuit ?", "Oui. Toutes les fonctionnalités décrites ici sont accessibles gratuitement, sans carte bancaire."],
  ["Dois-je connecter mon compte bancaire ?", "Non. Tu saisis tes opérations ou importes un relevé CSV exporté depuis ta banque. BUDGETLY ne te demandera jamais tes identifiants bancaires."],
  ["Les aides affichées sont-elles garanties ?", "Non. BUDGETLY estime prudemment si une aide pourrait te concerner et te renvoie vers l'organisme officiel, seul habilité à décider. Une aide potentielle n'est jamais ajoutée à ton solde."],
  ["Les offres d'emploi sont-elles réelles ?", "Elles proviennent uniquement de sources autorisées connectées (API France Travail lorsque l'accès est configuré). Les exemples du mode démonstration sont clairement étiquetés comme fictifs."],
  ["Comment sont calculées les prévisions ?", "Par un moteur déterministe : solde actuel, revenus récurrents déclarés, charges prévues et moyenne de tes dépenses variables. Les hypothèses sont affichées à chaque fois."],
  ["Une IA a-t-elle accès à mes données ?", "Le coach fonctionne sans IA. Une reformulation par IA est possible uniquement si tu y consens explicitement, et seule la réponse déjà calculée est transmise — jamais ton historique."],
  ["Puis-je supprimer mes données ?", "Oui, à tout moment depuis les paramètres : export complet en JSON et suppression définitive du compte."],
];

export default function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-night text-white">
        <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80"><span className="size-1.5 rounded-full bg-positive" /> Pour les étudiants et jeunes actifs</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">Prends le contrôle de ton argent et découvre de <span className="bg-gradient-to-r from-[#A594FF] to-[#22C55E] bg-clip-text text-transparent">nouvelles opportunités.</span></h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">BUDGETLY t'aide à gérer ton budget, économiser au quotidien, découvrir les aides qui te correspondent et trouver des revenus complémentaires adaptés à ta vie.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href="/signup">Commencer gratuitement <ArrowRight /></Link></Button>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" asChild><a href="#solution">Découvrir la plateforme</a></Button>
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10" asChild><Link href="/demo">Essayer la démonstration</Link></Button>
            </div>
            <p className="mt-6 text-sm text-white/55">Sans carte bancaire · Sans connexion bancaire · Tes données ne sont jamais vendues</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="probleme">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Le constat</p>
        <h2 id="probleme" className="mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">Gérer son argent quand on étudie, c'est jongler avec trop d'incertitudes.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROBLEMS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5"><Icon className="size-6 text-brand" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
          ))}
        </div>
      </section>

      <section id="solution" className="bg-surface-2 py-20" aria-labelledby="solution-title">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">La solution</p>
          <h2 id="solution-title" className="mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">Pas un simple gestionnaire de budget : un copilote de vie financière.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {PILLARS.map((p) => (
              <div key={p.n} className="rounded-2xl bg-surface p-5 shadow-sm"><p className="font-display text-3xl font-extrabold text-brand/30">{p.n}</p><h3 className="mt-2 text-lg font-bold">{p.title}</h3><p className="mt-1 text-sm text-muted">{p.text}</p></div>
            ))}
          </div>
          <div className="mt-10 rounded-3xl bg-night p-6 text-white sm:p-8">
            <p className="text-sm font-semibold text-[#A594FF]">Exemple concret</p>
            <p className="mt-2 text-xl font-semibold">Léa risque de finir le mois à −80 €. BUDGETLY le détecte 5 jours avant, puis propose :</p>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <li className="rounded-2xl bg-white/5 p-4">Un plafond de dépenses quotidien jusqu'à la fin du mois</li>
              <li className="rounded-2xl bg-white/5 p-4">La comparaison de deux abonnements vidéo redondants</li>
              <li className="rounded-2xl bg-white/5 p-4">Une aide à vérifier auprès de l'organisme officiel</li>
              <li className="rounded-2xl bg-white/5 p-4">Une mission compatible avec ses disponibilités</li>
            </ul>
            <p className="mt-4 text-sm text-white/60">Léa choisit ses actions ; BUDGETLY mesure ensuite les résultats réellement obtenus.</p>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="features-title">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Fonctionnalités</p>
        <h2 id="features-title" className="mt-2 text-3xl font-bold sm:text-4xl">Tout ce qu'il faut, rien d'inventé.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md"><span className="inline-flex rounded-xl bg-brand-soft p-2 text-brand"><Icon className="size-5" /></span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
          ))}
        </div>
      </section>

      <section id="securite" className="bg-night py-20 text-white" aria-labelledby="secu-title">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#A594FF]">Sécurité & confidentialité</p>
          <h2 id="secu-title" className="mt-2 max-w-3xl text-3xl font-bold sm:text-4xl">Tes données financières sont à toi.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Lock, "Isolation stricte", "Chaque ligne en base est protégée par Row Level Security : personne d'autre ne peut lire tes données."],
              [ShieldCheck, "Aucun identifiant bancaire", "Saisie manuelle ou import CSV. Les fichiers ne sont jamais stockés."],
              [Eye, "Transparence", "Chaque calcul affiche ses hypothèses ; chaque aide ou offre affiche sa source."],
              [Server, "Contrôle total", "Export complet de tes données et suppression du compte à tout moment."],
            ].map(([Icon, t, x]) => {
              const I = Icon as typeof Lock;
              return <div key={t as string} className="rounded-2xl border border-white/10 bg-white/5 p-5"><I className="size-6 text-[#A594FF]" /><h3 className="mt-3 font-semibold">{t as string}</h3><p className="mt-1 text-sm text-white/65">{x as string}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-20" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-center text-3xl font-bold sm:text-4xl">Questions fréquentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-border bg-surface p-5">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl rounded-[32px] bg-gradient-to-br from-brand to-[#4F2FD8] p-8 text-center text-white sm:p-14">
          <BadgeEuro className="mx-auto size-10" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Ton argent. Tes opportunités. Ton avenir.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Crée ton compte en une minute et obtiens ton premier plan d'action personnalisé.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-white text-brand hover:bg-white/90" asChild><Link href="/signup">Créer un compte gratuitement</Link></Button>
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/10" asChild><Link href="/demo">Voir la démo</Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
}
