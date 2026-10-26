import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#7357F6" />
      <path d="M10 8h7.2c3.3 0 5.3 1.7 5.3 4.3 0 1.7-.9 2.9-2.4 3.5 1.9.5 3.1 1.9 3.1 3.9 0 2.9-2.2 4.3-5.6 4.3H10V8Z" fill="#fff" />
      <path d="M13.6 11v3.8h3.2c1.3 0 2-.7 2-1.9 0-1.2-.7-1.9-2-1.9h-3.2Zm0 6.6v4.4h3.7c1.5 0 2.3-.8 2.3-2.2 0-1.4-.8-2.2-2.3-2.2h-3.7Z" fill="#7357F6" />
      <circle cx="24.5" cy="8" r="2.5" fill="#22C55E" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight", className)} aria-label="BUDGETLY — accueil">
      <LogoMark />
      <span>BUDGETLY</span>
    </Link>
  );
}
