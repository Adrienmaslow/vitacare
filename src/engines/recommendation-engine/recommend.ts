import { CHAPTERS, conceptById, conceptsOfChapter, lessonById, lessonForConcept } from '@/content';
import type { Derived, LearningData } from '@/features/progress/derive';
import { dayKey } from '@/lib/dates';
import type { Recommendation } from '@/types';

/**
 * Moteur de recommandation à règles explicites (pas d'IA).
 * Chaque recommandation affiche la règle qui l'a déclenchée (`reason`).
 * Ordre de priorité : diagnostic → révisions en retard → erreurs récentes → notions à revoir
 * → prérequis manquants → leçon suivante → passage au chapitre suivant → exercices de TD.
 */
export function recommend(
  data: LearningData,
  d: Derived,
  opts: { diagnosticDone: boolean; dailyGoalMin: number; now?: number },
): Recommendation[] {
  const now = opts.now ?? Date.now();
  const recs: Recommendation[] = [];
  const add = (r: Recommendation) => {
    if (!recs.some((x) => x.id === r.id)) recs.push(r);
  };

  // 1. Premier lancement : diagnostic du cours 0.
  if (!opts.diagnosticDone && data.attempts.length === 0) {
    add({
      id: 'diagnostic',
      kind: 'diagnostic',
      title: 'Faire le test diagnostic du cours 0',
      reason:
        'Aucune donnée encore : 3 questions par outil (unités, loi d’Ohm, Kirchhoff, diviseurs) pour savoir ce que tu peux sauter.',
      to: '/diagnostic',
      minutes: 6,
    });
  }

  // 2. Flashcards dues.
  if (d.dueCards > 0) {
    add({
      id: 'due-cards',
      kind: 'flashcards',
      title: `Réviser ${d.dueCards} carte${d.dueCards > 1 ? 's' : ''} due${d.dueCards > 1 ? 's' : ''}`,
      reason: 'Répétition espacée : ces cartes arrivent à échéance aujourd’hui ou sont en retard.',
      to: '/flashcards?mode=dues',
      minutes: Math.max(2, Math.ceil(d.dueCards * 0.5)),
    });
  }

  // 3. Erreurs récentes (7 jours) non corrigées.
  const weekAgo = now - 7 * 86_400_000;
  const recent = data.mistakes.filter((m) => !m.resolved && m.at >= weekAgo);
  const unitErrors = recent.filter((m) => m.category === 'unites').length;
  if (unitErrors >= 3) {
    add({
      id: 'units-drill',
      kind: 'quiz',
      title: 'Mini-QCM de 5 minutes sur les unités',
      reason: `${unitErrors} erreurs d’unités détectées cette semaine.`,
      to: '/qcm/session?mode=concept&concepts=c0-unites&n=6',
      minutes: 5,
    });
  }
  const byConcept = new Map<string, number>();
  for (const m of recent)
    for (const c of m.conceptIds) byConcept.set(c, (byConcept.get(c) ?? 0) + 1);
  const worst = [...byConcept.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) {
    const concept = conceptById(worst[0]);
    const lesson = lessonForConcept(worst[0]);
    if (concept && lesson) {
      add({
        id: `review-${concept.id}`,
        kind: 'review',
        title: `Revoir « ${concept.title} »`,
        reason: `${worst[1]} erreurs récentes sur cette notion.`,
        to: `/lecons/${lesson.id}`,
        minutes: lesson.durationMin,
      });
    }
  }
  if (recent.length > 0 && !recs.some((r) => r.kind === 'mistakes')) {
    add({
      id: 'mistakes',
      kind: 'mistakes',
      title: 'Retravailler mes erreurs',
      reason: `${recent.length} erreur${recent.length > 1 ? 's' : ''} non corrigée${recent.length > 1 ? 's' : ''} ces 7 derniers jours.`,
      to: '/qcm/session?mode=erreurs',
      minutes: 8,
    });
  }

  // 4. Notions à revoir (oubli ou échecs récents).
  for (const m of d.mastery.values()) {
    if (m.status !== 'a-revoir') continue;
    const concept = conceptById(m.conceptId);
    if (!concept) continue;
    add({
      id: `stale-${m.conceptId}`,
      kind: 'quiz',
      title: `Consolider « ${concept.title} »`,
      reason:
        'Notion travaillée mais à revoir (dernières réponses fausses ou pas révisée depuis plus de 3 semaines).',
      to: `/qcm/session?mode=concept&concepts=${m.conceptId}&n=5`,
      minutes: 5,
    });
    if (recs.length > 6) break;
  }

  // 5. Leçon suivante du parcours, avec contrôle des prérequis.
  const next = d.pathLessons.find(
    (l) => d.lessonStatus.get(l.id) !== 'termine' && d.lessonStatus.get(l.id) !== 'a-revoir',
  );
  if (next) {
    const missing = next.prerequisiteLessonIds
      .map((id) => lessonById(id))
      .filter((p) => p && d.lessonStatus.get(p.id) === 'a-decouvrir');
    const weakPrereq = next.prerequisiteLessonIds
      .map((id) => lessonById(id))
      .find(
        (p) =>
          p &&
          p.conceptIds.some((c) => {
            const m = d.mastery.get(c);
            return m && m.evidence >= 2 && m.score < 0.4;
          }),
      );
    const pre = missing[0] ?? weakPrereq;
    if (pre) {
      add({
        id: `prereq-${pre.id}`,
        kind: 'lesson',
        title: `Commence par « ${pre.title} »`,
        reason: `C’est un prérequis de « ${next.title} » ${missing[0] ? 'que tu n’as pas encore ouvert' : 'dont la maîtrise est encore faible'}.`,
        to: `/lecons/${pre.id}`,
        minutes: pre.durationMin,
      });
    } else {
      add({
        id: `next-${next.id}`,
        kind: 'lesson',
        title:
          d.lessonStatus.get(next.id) === 'en-cours'
            ? `Terminer « ${next.title} »`
            : `Leçon suivante : « ${next.title} »`,
        reason: 'Prochaine étape de ton parcours guidé.',
        to: `/lecons/${next.id}`,
        minutes: next.durationMin,
      });
    }
  }

  // 6. Chapitre maîtrisé → passer au suivant ; chapitre lu → faire son TD.
  for (const ch of CHAPTERS) {
    const concepts = conceptsOfChapter(ch.id);
    const studied = concepts.filter((c) => (d.mastery.get(c.id)?.evidence ?? 0) > 0);
    const masteredShare = studied.length
      ? studied.filter((c) => d.mastery.get(c.id)?.status === 'maitrisee').length / concepts.length
      : 0;
    const nextCh = CHAPTERS.find((c) => c.number === ch.number + 1);
    if (masteredShare >= 0.6 && nextCh) {
      const nextLessons = d.pathLessons.filter((l) => l.chapterId === nextCh.id);
      if (nextLessons.some((l) => d.lessonStatus.get(l.id) === 'a-decouvrir')) {
        add({
          id: `advance-${nextCh.id}`,
          kind: 'lesson',
          title: `Tu maîtrises le ${ch.shortTitle.toLowerCase()} : passe au ${nextCh.shortTitle.toLowerCase()}`,
          reason: `${Math.round(masteredShare * 100)} % des notions du ${ch.shortTitle.toLowerCase()} sont maîtrisées.`,
          to: `/chapitres/${nextCh.id}`,
          minutes: 10,
        });
      }
    }
    for (const td of ch.tds) {
      const chLessons = d.pathLessons.filter((l) => l.chapterId === ch.id);
      const done = chLessons.filter(
        (l) =>
          d.lessonStatus.get(l.id) !== 'a-decouvrir' && d.lessonStatus.get(l.id) !== 'en-cours',
      ).length;
      const exStarted = data.exerciseProgress.some((p) =>
        p.exerciseId.startsWith(td.toLowerCase()),
      );
      if (chLessons.length && done / chLessons.length >= 0.5 && !exStarted) {
        add({
          id: `td-${td}`,
          kind: 'exercise',
          title: `Attaquer le ${td}`,
          reason: `Tu as terminé au moins la moitié des leçons du ${ch.shortTitle.toLowerCase()}, et tu n’as pas encore commencé ses exercices.`,
          to: `/exercices?td=${td}`,
          minutes: 20,
        });
      }
    }
  }

  // Budget temps : on garde l'ordre de priorité et on signale ce qui tient dans l'objectif du jour.
  return recs.slice(0, 6);
}

/** Recommandations qui tiennent dans le temps restant aujourd'hui. */
export function planForToday(recs: Recommendation[], remainingMin: number): Recommendation[] {
  const plan: Recommendation[] = [];
  let budget = Math.max(remainingMin, 10);
  for (const r of recs) {
    if (r.minutes <= budget || plan.length === 0) {
      plan.push(r);
      budget -= r.minutes;
    }
  }
  return plan;
}

export const todayKey = () => dayKey();
