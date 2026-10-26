"use client";
import { Dialog as D, Progress as P, Switch as S, Tabs as T, Tooltip as TT } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------- Badge ---------------- */
const badgeTones = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;
export type Tone = keyof typeof badgeTones;
export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3", badgeTones[tone], className)} {...props} />;
}

/* ---------------- Progress ---------------- */
export function ProgressBar({ value, tone = "brand", label, className }: { value: number; tone?: "brand" | "positive" | "warning" | "danger"; label: string; className?: string }) {
  const color = { brand: "bg-brand", positive: "bg-positive", warning: "bg-warning", danger: "bg-danger" }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <P.Root value={v} aria-label={label} className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <P.Indicator className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${v}%` }} />
    </P.Root>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({ checked, onCheckedChange, id, label, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; label: string; disabled?: boolean }) {
  return (
    <S.Root id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} disabled={disabled}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-border transition data-[state=checked]:bg-brand disabled:opacity-50">
      <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
    </S.Root>
  );
}

/* ---------------- Tabs ---------------- */
export const Tabs = T.Root;
export function TabsList({ className, ...p }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1", className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: React.ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...p} />;
}
export const TabsContent = T.Content;

/* ---------------- Tooltip ---------------- */
export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <TT.Provider delayDuration={200}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content sideOffset={6} className="z-50 max-w-xs rounded-lg bg-night px-3 py-2 text-xs leading-relaxed text-white shadow-lg">
            {content}
            <TT.Arrow className="fill-night" />
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}

/* ---------------- Dialog ---------------- */
export function Modal({ open, onOpenChange, title, description, children, footer, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm data-[state=open]:animate-in" />
        <D.Content className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Fermer"><X className="size-5" /></D.Close>
          </div>
          {children}
          {footer ? <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ---------------- Skeleton & états ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <div className="rounded-2xl bg-brand-soft p-3 text-brand"><Icon className="size-6" /></div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
      <p className="font-semibold">Impossible de charger ces données</p>
      <p className="mt-1">{message}</p>
      {onRetry ? <button onClick={onRetry} className="mt-2 cursor-pointer font-semibold underline">Réessayer</button> : null}
    </div>
  );
}

export function Notice({ tone = "brand", icon: Icon, children, className }: { tone?: Tone; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl p-3.5 text-sm", badgeTones[tone], className)}>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" /> : null}
      <div className="leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}
