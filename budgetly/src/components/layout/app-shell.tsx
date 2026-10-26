"use client";
import { Bell, FlaskConical, LogOut, RotateCcw, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isActive, MAIN_NAV, MOBILE_NAV, TOOLS_NAV } from "@/config/navigation";
import { useOp } from "@/hooks/use-op";
import { callOp, getMode, resetDemo, setDemoCookie } from "@/lib/ops/client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useMode() {
  return useSyncExternalStore(() => () => undefined, getMode, () => "live" as const);
}

export async function signOut(router: ReturnType<typeof useRouter>) {
  if (getMode() === "demo") {
    setDemoCookie(false);
    await resetDemo();
  } else {
    await getBrowserSupabase()?.auth.signOut();
  }
  router.replace("/");
  router.refresh();
}

function NavLink({ href, label, icon: Icon, pathname, badge }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; pathname: string; badge?: number }) {
  const active = isActive(pathname, href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition", active ? "bg-brand text-white shadow-sm shadow-brand/30 dark:text-night" : "text-white/70 hover:bg-white/5 hover:text-white")}>
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{label}</span>
      {badge ? <span className={cn("rounded-full px-1.5 text-[11px] font-bold", active ? "bg-white/25" : "bg-danger text-white")}>{badge > 9 ? "9+" : badge}</span> : null}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const mode = useMode();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const profile = useOp("profile.get", {});
  const notifications = useOp("notifications.list", { unreadOnly: true, limit: 1 });
  const booted = useRef(false);
  const [ready, setReady] = useState(false);

  // Au démarrage : échéances récurrentes puis alertes (opérations idempotentes).
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        await callOp("recurring.sync", {});
        await callOp("alerts.refresh", {});
        await qc.invalidateQueries();
      } catch {
        /* non bloquant */
      } finally {
        setReady(true);
      }
    })();
  }, [qc]);

  useEffect(() => {
    const p = profile.data?.profile;
    if (p && !p.onboarding_completed_at && !pathname.startsWith("/app/onboarding")) router.replace("/app/onboarding");
  }, [profile.data, pathname, router]);

  const unread = notifications.data?.unread ?? 0;

  return (
    <div className="min-h-dvh lg:pl-72">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Aller au contenu</a>
      {/* Barre latérale desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-night px-4 py-5 text-white lg:flex" aria-label="Navigation principale">
        <Logo href="/app" className="px-2 text-white" />
        <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto pr-1">
          {MAIN_NAV.map((n) => <NavLink key={n.href} {...n} pathname={pathname} badge={n.href === "/app/notifications" ? unread : undefined} />)}
          <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Outils</p>
          {TOOLS_NAV.map((n) => <NavLink key={n.href} {...n} pathname={pathname} />)}
        </nav>
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.data?.profile.display_name || "Mon espace"}</p>
              <p className="text-xs text-white/50">{mode === "demo" ? "Démonstration" : "Compte personnel"}</p>
            </div>
            <ThemeToggle className="bg-white/10 [&_button]:text-white/70" />
          </div>
          <button onClick={() => signOut(router)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut className="size-[18px]" /> {mode === "demo" ? "Quitter la démo" : "Se déconnecter"}
          </button>
        </div>
      </aside>

      {/* Barre supérieure mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo href="/app" className="text-base" />
        <Link href="/app/notifications" className="relative rounded-xl p-2 hover:bg-surface-2" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
          <Bell className="size-5" />
          {unread ? <span className="absolute right-1 top-1 size-2.5 rounded-full bg-danger ring-2 ring-background" /> : null}
        </Link>
      </header>

      {mode === "demo" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/20 bg-brand-soft px-4 py-2 text-sm lg:px-8">
          <p className="flex items-center gap-2 text-foreground"><FlaskConical className="size-4 text-brand" /> <strong>Mode démonstration</strong> — données fictives, stockées uniquement dans ce navigateur.</p>
          <div className="flex gap-3">
            <button className="flex cursor-pointer items-center gap-1 font-semibold text-brand hover:underline" onClick={async () => { await resetDemo(); await qc.resetQueries(); toast.success("Démonstration réinitialisée"); router.refresh(); }}>
              <RotateCcw className="size-3.5" /> Réinitialiser
            </button>
            <Link href="/signup" className="font-semibold text-brand hover:underline">Créer mon compte</Link>
          </div>
        </div>
      ) : null}
      {!online ? (
        <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning lg:px-8"><WifiOff className="size-4" /> Hors ligne : les données affichées peuvent ne pas être à jour et les modifications sont désactivées.</div>
      ) : null}

      <main id="contenu" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8" data-ready={ready}>
        {children}
      </main>

      {/* Navigation mobile */}
      <nav aria-label="Navigation mobile" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/app/opportunities"
              ? ["/app/opportunities", "/app/earn", "/app/aids", "/app/deals"].some((h) => isActive(pathname, h))
              : href === "/app/profile"
                ? !MOBILE_NAV.slice(0, 4).some((n) => isActive(pathname, n.href)) && !["/app/earn", "/app/aids", "/app/deals", "/app/opportunities"].some((h) => isActive(pathname, h))
                : isActive(pathname, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
                  <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
