"use client";
import { Bot, Info, Send, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Switch } from "@/components/ui/misc";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { callOp, OpError } from "@/lib/ops/client";
import type { OpOutput } from "@/lib/ops/registry";

type Answer = OpOutput<"coach.ask">;
type Msg = { role: "user"; text: string } | { role: "coach"; answer: Answer } | { role: "error"; text: string };
const SUGGESTIONS = [
  "Combien puis-je encore dépenser cette semaine ?",
  "Pourquoi ai-je autant dépensé ce mois-ci ?",
  "Est-ce que je peux acheter un ordinateur à 700 € ?",
  "Comment économiser 300 € en deux mois ?",
  "Quels abonnements pourrais-je comparer ?",
  "Quelles aides devrais-je vérifier ?",
  "Comment trouver un complément de revenu ?",
  "Comment éviter d'être à découvert ?",
];

export default function CoachPage() {
  const profile = useOp("profile.get", {});
  const consent = useMutationOp("consents.set");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const aiConsent = profile.data?.consents.find((c) => c.purpose === "ai_coach")?.granted ?? false;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const answer = await callOp("coach.ask", { question, useAI: useAI && aiConsent });
      setMessages((m) => [...m, { role: "coach", answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: e instanceof OpError ? e.message : "Le coach n'a pas pu répondre." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Budgetly Coach" description="Pose tes questions en langage naturel. Les chiffres sont toujours calculés par BUDGETLY à partir de tes données, jamais inventés." />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="flex min-h-[60dvh] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {!messages.length ? (
              <div className="py-6 text-center">
                <div className="mx-auto w-fit rounded-2xl bg-brand-soft p-3 text-brand"><Bot className="size-7" /></div>
                <p className="mt-3 font-semibold">Comment puis-je t'aider ?</p>
                <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm hover:border-brand hover:bg-brand-soft">{s}</button>)}</div>
              </div>
            ) : null}
            {messages.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end gap-2"><p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white dark:text-night">{m.text}</p><User className="mt-2 size-5 text-muted" /></div>
            ) : m.role === "error" ? (
              <p key={i} role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{m.text}</p>
            ) : (
              <div key={i} className="flex gap-2">
                <Bot className="mt-2 size-5 shrink-0 text-brand" />
                <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-surface-2 p-4 text-sm">
                  {m.answer.aiText ? <><Badge tone="brand" className="mb-2"><Sparkles /> Reformulé par IA</Badge><p className="whitespace-pre-line">{m.answer.aiText}</p><hr className="my-3 border-border" /><p className="mb-1 text-xs font-semibold text-muted">Réponse calculée :</p></> : null}
                  <div className="space-y-2">{m.answer.paragraphs.map((p, j) => <p key={j} className="whitespace-pre-line">{p}</p>)}</div>
                  {m.answer.facts.length ? (
                    <dl className="mt-3 grid gap-1.5 rounded-xl bg-surface p-3 text-xs">{m.answer.facts.map((f) => <div key={f.label} className="flex justify-between gap-3"><dt className="text-muted">{f.label} {f.kind === "estimate" ? <Badge tone="warning">estimation</Badge> : <Badge tone="positive">fait</Badge>}</dt><dd className="font-semibold tabular">{f.value}</dd></div>)}</dl>
                  ) : null}
                  {m.answer.assumptions.length ? <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer font-medium">Hypothèses ({m.answer.assumptions.length})</summary><ul className="mt-1 list-disc pl-4">{m.answer.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details> : null}
                  {m.answer.sources.length ? <p className="mt-2 text-xs text-muted">Sources : {m.answer.sources.join(" · ")}</p> : null}
                  {m.answer.actions.length ? <div className="mt-3 flex flex-wrap gap-2">{m.answer.actions.map((a) => <Button key={a.href} size="sm" variant="outline" asChild><Link href={a.href}>{a.label}</Link></Button>)}</div> : null}
                  {m.answer.aiStatus === "no_consent" ? <p className="mt-2 text-xs text-warning">Reformulation IA non utilisée : consentement non donné.</p> : m.answer.aiStatus === "unavailable" && useAI ? <p className="mt-2 text-xs text-muted">IA indisponible : réponse déterministe uniquement.</p> : null}
                </div>
              </div>
            ))}
            {busy ? <p className="text-sm text-muted">Le coach calcule…</p> : null}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <label htmlFor="coach-input" className="sr-only">Ta question</label>
            <input id="coach-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Ex. Est-ce que je peux m'offrir un concert à 45 € ?" className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none" />
            <Button type="submit" size="icon" aria-label="Envoyer" disabled={busy || !input.trim()}><Send /></Button>
          </form>
        </Card>
        <aside className="space-y-4">
          <Card className="p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Info className="size-4 text-brand" /> Comment ça marche</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted"><li>Les montants sont calculés par des règles déterministes et testées.</li><li>Chaque réponse distingue faits, estimations et hypothèses.</li><li>Aucune donnée ne quitte BUDGETLY sans ton accord.</li><li>Aucune modification de tes données sans confirmation.</li><li>Pas de conseil en investissement réglementé.</li></ul>
          </Card>
          <Card className="p-4 text-sm">
            <p className="font-semibold">Reformulation par IA (facultatif)</p>
            <p className="mt-1 text-muted">Si le serveur est configuré, une IA peut reformuler la réponse calculée. Seules la question et la réponse calculée lui sont transmises (jamais ton historique). Fournisseur : Anthropic.</p>
            <label className="mt-3 flex items-center justify-between gap-2"><span>J'accepte ce traitement</span><Switch label="Consentement IA" checked={aiConsent} onCheckedChange={(v) => consent.mutate({ purpose: "ai_coach", granted: v })} /></label>
            <label className="mt-2 flex items-center justify-between gap-2"><span>Utiliser l'IA</span><Switch label="Utiliser l'IA" checked={useAI} disabled={!aiConsent} onCheckedChange={setUseAI} /></label>
          </Card>
        </aside>
      </div>
    </>
  );
}
