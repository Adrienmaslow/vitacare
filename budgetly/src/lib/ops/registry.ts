/**
 * Registre de toutes les opérations exposées. Seules les opérations listées ici
 * sont exécutables via /api/ops/[name].
 */
import { accountOps } from "@/features/accounts/ops";
import { planOps } from "@/features/action-plan/ops";
import { aidOps } from "@/features/aids/ops";
import { coachOps } from "@/features/coach/ops";
import { dealOps } from "@/features/deals/ops";
import { earnOps } from "@/features/earn/ops";
import { financeOps } from "@/features/finance/ops";
import { gamificationOps } from "@/features/gamification/ops";
import { importOps } from "@/features/imports/ops";
import { lifeOps } from "@/features/life/ops";
import { notificationOps } from "@/features/notifications/ops";
import { profileOps } from "@/features/profile/ops";
import { simulationOps } from "@/features/simulations/ops";
import { transactionOps } from "@/features/transactions/ops";

export const registry = {
  ...profileOps, ...accountOps, ...transactionOps, ...importOps, ...financeOps, ...notificationOps,
  ...earnOps, ...aidOps, ...dealOps, ...lifeOps, ...planOps, ...coachOps, ...simulationOps, ...gamificationOps,
};

export type Registry = typeof registry;
export type OpName = keyof Registry;
export type OpInput<N extends OpName> = import("zod").input<Registry[N]["input"]>;
export type OpOutput<N extends OpName> = Awaited<ReturnType<Registry[N]["run"]>>;
