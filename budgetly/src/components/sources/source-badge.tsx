import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { fmt } from "@/lib/dates";
import { Badge, Tip } from "@/components/ui/misc";
import type { SourceInfo, VerificationStatus } from "@/data/sources";

/** Provenance d'une donnée externe : fournisseur, lien, dates et état de vérification. */
export function SourceLine({ source, status }: { source: SourceInfo; status: VerificationStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
        {source.provider} <ExternalLink className="size-3" />
      </a>
      {status === "verified" ? (
        <Badge tone="positive"><ShieldCheck /> Vérifié le {fmt.full(source.verifiedAt!)}</Badge>
      ) : status === "expired" ? (
        <Badge tone="danger">Expiré</Badge>
      ) : (
        <Tip content={`Fiche rédigée le ${fmt.full(source.addedAt)} sans vérification en ligne. Les conditions et le lien doivent être confirmés sur le site officiel avant toute démarche.`}>
          <span tabIndex={0}><Badge tone="warning"><ShieldAlert /> À vérifier sur la source</Badge></span>
        </Tip>
      )}
    </div>
  );
}
