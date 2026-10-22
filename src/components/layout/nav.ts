import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CalendarClock,
  Layers,
  LayoutDashboard,
  Library,
  ListChecks,
  PenLine,
  Route,
  Settings,
  Sigma,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: 'apprendre' | 'pratiquer' | 'suivre' | 'autre';
}

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'apprendre' },
  { to: '/parcours', label: 'Parcours', icon: Route, group: 'apprendre' },
  { to: '/chapitres', label: 'Chapitres', icon: BookOpen, group: 'apprendre' },
  { to: '/formules', label: 'Formules', icon: Sigma, group: 'apprendre' },
  { to: '/exercices', label: 'Exercices TD', icon: PenLine, group: 'pratiquer' },
  { to: '/qcm', label: 'QCM', icon: ListChecks, group: 'pratiquer' },
  { to: '/examen', label: 'Examen blanc', icon: Timer, group: 'pratiquer' },
  { to: '/flashcards', label: 'Flashcards', icon: Layers, group: 'pratiquer' },
  { to: '/revisions', label: 'Révisions', icon: CalendarClock, group: 'suivre' },
  { to: '/erreurs', label: 'Mes erreurs', icon: AlertCircle, group: 'suivre' },
  { to: '/statistiques', label: 'Statistiques', icon: BarChart3, group: 'suivre' },
  { to: '/ressources', label: 'Ressources', icon: Library, group: 'autre' },
  { to: '/parametres', label: 'Paramètres', icon: Settings, group: 'autre' },
];

export const GROUP_LABEL = {
  apprendre: 'Apprendre',
  pratiquer: 'S’entraîner',
  suivre: 'Suivre',
  autre: 'Plus',
} as const;

export const MOBILE_PRIMARY = ['/dashboard', '/parcours', '/exercices', '/qcm'];
