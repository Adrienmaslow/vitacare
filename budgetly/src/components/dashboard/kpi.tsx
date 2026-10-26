import { Info } from "lucide-react";
import { Money } from "@/components/ui/money";
import { Tip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function Kpi({ label, value, help, tone, sub, highlight }: { label: string; value: number; help: string; tone?: "positive" | "danger" | "auto"; sub?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-4", highlight && "border-transparent bg-night text-white dark:bg-brand-soft dark:text-foreground")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-xs font-medium", highlight ? "text-white/70 dark:text-muted" : "text-muted")}>{label}</p>
        <Tip content={help}>
          <button type="button" aria-label={`Définition : ${label}`} className="cursor-help rounded-md p-0.5 opacity-60 hover:opacity-100"><Info className="size-3.5" /></button>
        </Tip>
      </div>
      <p className="mt-1.5 font-display text-xl font-bold sm:text-2xl">
        <Money value={value} colored={tone === "auto"} className={tone === "positive" ? "text-positive" : tone === "danger" ? "text-danger" : undefined} />
      </p>
      {sub ? <div className={cn("mt-1 text-xs", highlight ? "text-white/70 dark:text-muted" : "text-muted")}>{sub}</div> : null}
    </div>
  );
}
