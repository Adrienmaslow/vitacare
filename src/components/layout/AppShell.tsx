import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Dialog } from '@/components/ui/Dialog';
import { useDerived } from '@/hooks/useLearning';
import { useSettings } from '@/stores/settings';
import { GROUP_LABEL, MOBILE_PRIMARY, NAV } from './nav';
import { Logo } from './Logo';

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const groups = ['apprendre', 'pratiquer', 'suivre', 'autre'] as const;
  const { derived } = useDerived();
  return (
    <nav aria-label="Navigation principale" className="grid gap-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1 px-3 text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
            {GROUP_LABEL[g]}
          </div>
          <ul className="grid gap-0.5">
            {NAV.filter((n) => n.group === g).map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-[0.93rem] font-medium transition-colors',
                      isActive ? 'bg-primary-soft text-primary' : 'text-text hover:bg-surface-2',
                    )
                  }
                >
                  <n.icon size={18} aria-hidden />
                  <span className="flex-1">{n.label}</span>
                  {n.to === '/revisions' && derived.dueCards > 0 && (
                    <span
                      className="rounded-full bg-primary px-1.5 text-xs text-primary-contrast tabular-nums"
                      aria-label={`${derived.dueCards} cartes dues`}
                    >
                      {derived.dueCards}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function StreakChip() {
  const { derived } = useDerived();
  const gamification = useSettings((s) => s.gamification);
  if (!gamification) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-navy">Niveau {derived.level}</span>
        <span className="text-muted tabular-nums">{derived.xp} XP</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary"
          style={{ width: `${(derived.xpIntoLevel / derived.xpForNextLevel) * 100}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-muted">
        Série : {derived.streak} jour{derived.streak > 1 ? 's' : ''}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-3 py-2 text-primary-contrast focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      {/* Barre latérale (ordinateur) */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-3 py-5 lg:flex">
        <div className="px-3">
          <Logo />
        </div>
        <SideNav />
        <div className="mt-auto px-1">
          <StreakChip />
        </div>
      </aside>

      {/* En-tête (mobile) */}
      <header
        className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Logo />
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-surface-2"
          aria-label="Ouvrir le menu"
          onClick={() => setMoreOpen(true)}
        >
          <Menu size={22} />
        </button>
      </header>

      <div className="lg:pl-64">
        <main
          id="main"
          key={location.pathname}
          className="print-area mx-auto w-full max-w-5xl min-w-0 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {/* Barre de navigation inférieure (mobile) */}
      <nav
        aria-label="Navigation rapide"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium',
                    isActive ? 'text-primary' : 'text-muted',
                  )
                }
              >
                <n.icon size={22} aria-hidden />
                {n.label.replace('Tableau de bord', 'Accueil').replace('Exercices TD', 'Exercices')}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted"
            >
              <Menu size={22} aria-hidden />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        <SideNav onNavigate={() => setMoreOpen(false)} />
        <div className="mt-5">
          <StreakChip />
        </div>
      </Dialog>
    </div>
  );
}
