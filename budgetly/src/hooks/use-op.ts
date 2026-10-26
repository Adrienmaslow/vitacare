"use client";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { callOp, OpError } from "@/lib/ops/client";
import type { OpInput, OpName, OpOutput } from "@/lib/ops/registry";

export function useOp<N extends OpName>(
  name: N,
  input?: OpInput<N>,
  options?: Omit<UseQueryOptions<OpOutput<N>, OpError>, "queryKey" | "queryFn">,
) {
  return useQuery<OpOutput<N>, OpError>({
    queryKey: [name, input ?? {}],
    queryFn: () => callOp(name, input),
    ...options,
  });
}

/** Mutation : invalide toutes les requêtes (données personnelles, faible volume) et affiche les erreurs. */
export function useMutationOp<N extends OpName>(name: N, opts: { success?: string | ((d: OpOutput<N>) => string); silent?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation<OpOutput<N>, OpError, OpInput<N>>({
    mutationFn: (input) => callOp(name, input),
    onSuccess: async (data) => {
      await qc.invalidateQueries();
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(data) : opts.success);
    },
    onError: (e) => {
      if (!opts.silent) toast.error(e.message, { description: e.fields ? Object.values(e.fields).slice(0, 3).join(" · ") : undefined });
    },
  });
}
