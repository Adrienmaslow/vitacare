import {
  Banknote, Briefcase, CircleDashed, GraduationCap, HandHeart, HeartPulse, House, Landmark, PartyPopper, PiggyBank, Plane,
  PlusCircle, Repeat, ShieldCheck, ShoppingBag, ShoppingBasket, Smartphone, Sparkles, Tag, TrainFront, Users, Utensils, Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: House, "shopping-basket": ShoppingBasket, "train-front": TrainFront, "heart-pulse": HeartPulse, "party-popper": PartyPopper,
  "shopping-bag": ShoppingBag, "graduation-cap": GraduationCap, repeat: Repeat, "shield-check": ShieldCheck, utensils: Utensils,
  plane: Plane, smartphone: Smartphone, landmark: Landmark, "circle-dashed": CircleDashed, briefcase: Briefcase, "hand-heart": HandHeart,
  users: Users, sparkles: Sparkles, "plus-circle": PlusCircle, wallet: Wallet, "piggy-bank": PiggyBank, banknote: Banknote, tag: Tag,
};

export function DynIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Tag;
  return <I className={className} aria-hidden />;
}

export const ACCOUNT_ICONS = ["wallet", "landmark", "piggy-bank", "banknote", "briefcase", "smartphone"];
