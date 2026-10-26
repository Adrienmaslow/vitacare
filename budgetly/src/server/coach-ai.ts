/**
 * Adaptateur IA facultatif du coach (niveau 2) — Anthropic Messages API.
 * Activé uniquement si ANTHROPIC_API_KEY est défini ET si l'utilisateur a donné son
 * consentement explicite (vérifié dans l'opération coach.ask).
 *
 * Données transmises : la question et la réponse déjà calculée par le moteur
 * déterministe (faits, hypothèses). Jamais l'historique des transactions.
 * Le modèle ne fait que reformuler : il lui est interdit d'inventer des chiffres.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { CoachAI } from "@/lib/ops/define";

const SYSTEM = `Tu es Budgetly Coach, un assistant budgétaire bienveillant pour étudiants et jeunes actifs.
Tu reçois une question et une réponse déjà calculée par un moteur déterministe (faits chiffrés, estimations, hypothèses).
Ta seule tâche : reformuler cette réponse en français clair, chaleureux et concis (120 mots maximum).
Règles strictes :
- N'utilise QUE les montants, dates et faits fournis. N'invente aucun chiffre, aucune transaction, aucune aide, aucune offre.
- Distingue clairement les faits des estimations.
- Ne donne aucun conseil d'investissement réglementé et n'encourage jamais l'endettement.
- Ne propose jamais de sacrifier des dépenses essentielles (logement, alimentation, santé, études).
- Si la réponse fournie est incomplète, dis-le simplement.`;

export function createCoachAI(): CoachAI | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  return {
    async rephrase({ question, answer }) {
      const payload = {
        question,
        reponse: answer.paragraphs,
        faits: answer.facts,
        hypotheses: answer.assumptions,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        model,
        max_tokens: 1024,
        system: SYSTEM,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      };
      const res = await client.beta.messages.create(params);
      if (res.stop_reason === "refusal") return null;
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return text || null;
    },
  };
}
