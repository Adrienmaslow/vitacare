import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <Logo className="relative text-white" />
        <div className="relative">
          <p className="font-display text-4xl font-extrabold leading-tight">Ton argent.<br />Tes opportunités.<br /><span className="text-[#A594FF]">Ton avenir.</span></p>
          <p className="mt-4 max-w-md text-white/70">Budget, prévisions, aides, bons plans et revenus complémentaires : un seul copilote pour reprendre la main sur tes finances.</p>
        </div>
        <p className="relative text-xs text-white/50">Tes données financières ne sont jamais vendues.</p>
      </section>
      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
          <p className="mt-8 text-center text-xs text-muted"><Link href="/" className="hover:underline">← Retour à l'accueil</Link></p>
        </div>
      </section>
    </main>
  );
}

export function ConfigMissing() {
  return (
    <div role="status" className="mb-5 rounded-2xl bg-warning-soft p-4 text-sm">
      <p className="font-semibold text-warning">Comptes utilisateurs non configurés sur ce serveur</p>
      <p className="mt-1 text-foreground/80">Les variables Supabase ne sont pas définies : la création de compte est indisponible. Tu peux essayer toutes les fonctionnalités avec la <Link href="/demo" className="font-semibold text-brand underline">démonstration</Link>.</p>
    </div>
  );
}
