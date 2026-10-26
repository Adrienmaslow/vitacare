import { Briefcase, Coins, HandHeart, Lightbulb } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

const ITEMS = [
  { href: "/app/earn", icon: Briefcase, title: "Gagner de l'argent", text: "Missions et jobs compatibles avec tes disponibilités, suivi de candidatures, calcul de rentabilité." },
  { href: "/app/aids", icon: HandHeart, title: "Mes aides", text: "Les dispositifs qui pourraient te concerner et le suivi de tes démarches." },
  { href: "/app/deals", icon: Coins, title: "Économiser", text: "Réductions étudiantes et comparateur de coûts basé sur tes vraies dépenses." },
  { href: "/app/life", icon: Lightbulb, title: "Vie quotidienne", text: "Courses, logement, transport, rentrée et culture financière." },
];

export default function OpportunitiesHub() {
  return (
    <>
      <PageHeader title="Opportunités" description="Tous les leviers pour améliorer ta situation." />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand/40">
            <span className="h-fit rounded-xl bg-brand-soft p-2.5 text-brand"><Icon className="size-5" /></span>
            <span><span className="block font-semibold">{title}</span><span className="text-sm text-muted">{text}</span></span>
          </Link>
        ))}
      </div>
    </>
  );
}
