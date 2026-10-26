"use client";
import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { signOut, useMode } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { MAIN_NAV, TOOLS_NAV } from "@/config/navigation";

export default function ProfileHub() {
  const router = useRouter();
  const mode = useMode();
  const links = [...MAIN_NAV.filter((n) => !["/app", "/app/accounts", "/app/coach"].includes(n.href)), ...TOOLS_NAV];
  return (
    <>
      <PageHeader title="Profil & menu" description="Toutes les sections de BUDGETLY." actions={<ThemeToggle />} />
      <nav aria-label="Toutes les sections" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
            <Icon className="size-5 text-brand" /><span className="flex-1 font-medium">{label}</span><ChevronRight className="size-4 text-muted" />
          </Link>
        ))}
      </nav>
      <Button variant="outline" className="mt-5 w-full" onClick={() => signOut(router)}><LogOut /> {mode === "demo" ? "Quitter la démo" : "Se déconnecter"}</Button>
    </>
  );
}
