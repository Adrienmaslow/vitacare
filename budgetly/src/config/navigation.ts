import {
  ArrowLeftRight, Bell, Bot, Calculator, ChartPie, Coins, HandHeart, House, LayoutDashboard, ListChecks, PiggyBank, Repeat, Settings,
  Sparkles, Target, TrendingUp, Trophy, Upload, User, Wallet, Briefcase, Lightbulb, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/app", label: "Accueil", icon: LayoutDashboard },
  { href: "/app/accounts", label: "Mon argent", icon: Wallet },
  { href: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/app/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/app/analytics", label: "Analyses", icon: ChartPie },
  { href: "/app/forecast", label: "Prévisions", icon: TrendingUp },
  { href: "/app/deals", label: "Économiser", icon: Coins },
  { href: "/app/earn", label: "Gagner de l'argent", icon: Briefcase },
  { href: "/app/aids", label: "Mes aides", icon: HandHeart },
  { href: "/app/goals", label: "Mes objectifs", icon: Target },
  { href: "/app/coach", label: "Mon coach", icon: Bot },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/settings", label: "Paramètres", icon: Settings },
];

export const TOOLS_NAV: NavItem[] = [
  { href: "/app/action-plan", label: "Plan d'action", icon: ListChecks },
  { href: "/app/subscriptions", label: "Abonnements", icon: Repeat },
  { href: "/app/simulator", label: "Simulateur", icon: Calculator },
  { href: "/app/import", label: "Import CSV", icon: Upload },
  { href: "/app/life", label: "Vie quotidienne", icon: Lightbulb },
  { href: "/app/achievements", label: "Succès", icon: Trophy },
];

export const MOBILE_NAV: NavItem[] = [
  { href: "/app", label: "Accueil", icon: House },
  { href: "/app/accounts", label: "Argent", icon: Wallet },
  { href: "/app/opportunities", label: "Opportunités", icon: Sparkles },
  { href: "/app/coach", label: "Coach", icon: Bot },
  { href: "/app/profile", label: "Profil", icon: User },
];

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}
