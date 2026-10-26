import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-night/85 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo className="text-white" />
          <nav aria-label="Navigation publique" className="hidden items-center gap-6 text-sm text-white/75 md:flex">
            <Link href="/#solution" className="hover:text-white">Solution</Link>
            <Link href="/#fonctionnalites" className="hover:text-white">Fonctionnalités</Link>
            <Link href="/#securite" className="hover:text-white">Sécurité</Link>
            <Link href="/#faq" className="hover:text-white">FAQ</Link>
          </nav>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" asChild><Link href="/login">Connexion</Link></Button>
            <Button size="sm" asChild><Link href="/signup">Commencer</Link></Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
          <div><Logo /><p className="mt-2">Ton argent. Tes opportunités. Ton avenir.</p></div>
          <nav aria-label="Liens légaux" className="grid gap-1.5"><Link href="/privacy" className="hover:text-foreground">Politique de confidentialité</Link><Link href="/legal" className="hover:text-foreground">Mentions légales</Link><Link href="/demo" className="hover:text-foreground">Démonstration</Link></nav>
          <p className="text-xs">BUDGETLY n'est ni une banque ni un conseiller en investissement. Les informations sur les aides et offres sont indicatives : seuls les organismes officiels font foi.</p>
        </div>
      </footer>
    </>
  );
}
