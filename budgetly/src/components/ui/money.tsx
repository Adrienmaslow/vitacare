import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Affiche un montant (centimes) avec couleur sémantique facultative. */
export function Money({ value, sign, colored, compact, className }: { value: number; sign?: boolean; colored?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("tabular whitespace-nowrap", colored && (value > 0 ? "text-positive" : value < 0 ? "text-danger" : ""), className)}>
      {formatMoney(value, { sign, compact })}
    </span>
  );
}
