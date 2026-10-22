import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  FastForward,
  ListChecks,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DIFFICULTY_LABEL, SourceTag } from '@/components/ui/misc';
import { LessonBlockView } from '@/components/lessons/LessonBlocks';
import { LessonStatusBadge, MasteryBadge } from '@/components/lessons/status';
import { QuizSession } from '@/components/quizzes/QuizSession';
import { chapterById, conceptById, lessonById, lessonsOfChapter, questionById } from '@/content';
import { completeLesson, startLesson } from '@/db/repo';
import { useDerived } from '@/hooks/useLearning';
import { useUi } from '@/stores/ui';
import type { Question } from '@/types';
import NotFoundPage from './NotFoundPage';

type Mode = 'read' | 'quiz' | 'skip';

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = lessonById(lessonId);
  const { derived } = useDerived();
  const openExplain = useUi((s) => s.openExplain);
  const toast = useUi((s) => s.toast);
  const [mode, setMode] = useState<Mode>('read');

  useEffect(() => {
    setMode('read');
    if (lesson) void startLesson(lesson.id);
  }, [lesson]);

  const quizQuestions = useMemo(
    () =>
      lesson
        ? lesson.quizQuestionIds
            .slice(0, 5)
            .map((id) => questionById(id))
            .filter((q): q is Question => !!q)
        : [],
    [lesson],
  );
  const skipQuestions = useMemo(
    () =>
      (lesson?.skipTestQuestionIds ?? [])
        .map((id) => questionById(id))
        .filter((q): q is Question => !!q),
    [lesson],
  );

  if (!lesson) return <NotFoundPage />;
  const chapter = chapterById(lesson.chapterId)!;
  const siblings = lessonsOfChapter(lesson.chapterId);
  const idx = siblings.findIndex((l) => l.id === lesson.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const status = derived.lessonStatus.get(lesson.id) ?? 'a-decouvrir';
  const done = status === 'termine' || status === 'a-revoir';
  const prereqs = lesson.prerequisiteLessonIds.map((p) => lessonById(p)!).filter(Boolean);

  async function finish() {
    await completeLesson(lesson!.id);
    toast({
      title: 'Leçon terminée',
      description: 'Vérifie maintenant ta compréhension avec le QCM de la leçon.',
      tone: 'success',
    });
    setMode('quiz');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0">
        <nav aria-label="Fil d’Ariane" className="mb-3 text-sm text-muted">
          <Link to="/parcours" className="hover:underline">
            Parcours
          </Link>{' '}
          /{' '}
          <Link to={`/chapitres/${chapter.id}`} className="hover:underline">
            {chapter.shortTitle}
          </Link>
        </nav>
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-[1.75rem]">
            {lesson.title}
          </h1>
          <p className="mt-1 text-muted">
            <span className="font-medium text-text">Pourquoi ? </span>
            {lesson.why}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <LessonStatusBadge status={status} />
            <Badge>
              <Clock size={12} aria-hidden /> {lesson.durationMin} min
            </Badge>
            <Badge>{DIFFICULTY_LABEL[lesson.difficulty]}</Badge>
            {lesson.essential && <Badge tone="teal">Essentiel TD</Badge>}
          </div>
        </header>

        {mode === 'read' && skipQuestions.length > 0 && !done && (
          <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
            <FastForward className="text-primary" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium text-navy">Tu connais déjà ?</span> Réponds à{' '}
              {skipQuestions.length} questions : si tout est juste, la leçon est validée et tu
              passes à la suite.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setMode('skip')}>
              Test de validation
            </Button>
          </Card>
        )}

        {mode === 'skip' && (
          <div className="mb-6">
            <QuizSession
              questions={skipQuestions}
              context="skip-test"
              refId={lesson.id}
              label={`Test de validation — ${lesson.title}`}
              onFinish={async (results) => {
                if (results.length && results.every((r) => r.result.correct)) {
                  await completeLesson(lesson.id, true);
                  toast({
                    title: 'Leçon validée par le test',
                    description: 'Tu peux passer à la suite.',
                    tone: 'success',
                  });
                }
              }}
              finishActions={(results) =>
                results.every((r) => r.result.correct) ? (
                  next ? (
                    <ButtonLink to={`/lecons/${next.id}`} icon={<ArrowRight size={16} />}>
                      Leçon suivante
                    </ButtonLink>
                  ) : (
                    <ButtonLink to={`/chapitres/${chapter.id}`}>Retour au chapitre</ButtonLink>
                  )
                ) : (
                  <Button onClick={() => setMode('read')}>Lire la leçon</Button>
                )
              }
            />
          </div>
        )}

        {mode === 'read' && (
          <div className="grid gap-5 text-[1.02rem]">
            {lesson.blocks.map((b, i) => (
              <LessonBlockView key={i} block={b} lessonId={lesson.id} index={i} />
            ))}
            <div className="flex flex-wrap gap-2 border-t border-border pt-5">
              {!done ? (
                <Button size="lg" onClick={finish} icon={<CheckCircle2 size={18} />}>
                  J’ai terminé la leçon
                </Button>
              ) : (
                <Button size="lg" onClick={() => setMode('quiz')} icon={<ListChecks size={18} />}>
                  QCM de la leçon
                </Button>
              )}
              <Button
                variant="ghost"
                size="lg"
                icon={<CircleHelp size={18} />}
                onClick={() => openExplain({ conceptIds: lesson.conceptIds })}
              >
                Explique-moi
              </Button>
            </div>
          </div>
        )}

        {mode === 'quiz' && (
          <div className="grid gap-4">
            <h2 className="text-lg font-semibold text-navy">Vérification : QCM de la leçon</h2>
            <QuizSession
              questions={quizQuestions}
              context="lesson"
              refId={lesson.id}
              label={`QCM — ${lesson.title}`}
              finishActions={() => (
                <>
                  {next ? (
                    <ButtonLink to={`/lecons/${next.id}`} icon={<ArrowRight size={16} />}>
                      Leçon suivante
                    </ButtonLink>
                  ) : (
                    <ButtonLink to={`/qcm/session?mode=chapitre&chapter=${chapter.id}`}>
                      QCM du chapitre
                    </ButtonLink>
                  )}
                  <Button variant="secondary" onClick={() => setMode('read')}>
                    Relire la leçon
                  </Button>
                </>
              )}
            />
          </div>
        )}

        <nav className="mt-8 flex justify-between gap-3" aria-label="Leçons voisines">
          {prev ? (
            <Link
              to={`/lecons/${prev.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"
            >
              <ArrowLeft size={15} /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/lecons/${next.id}`}
              className="inline-flex items-center gap-1 text-right text-sm text-muted hover:text-text"
            >
              {next.title} <ArrowRight size={15} />
            </Link>
          )}
        </nav>
      </article>

      <aside className="grid content-start gap-4 lg:sticky lg:top-8">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-navy">Notions abordées</h2>
          <ul className="mt-2 grid gap-2">
            {lesson.conceptIds.map((c) => {
              const m = derived.mastery.get(c);
              return (
                <li key={c} className="text-sm">
                  <div>{conceptById(c)?.title}</div>
                  {m && <MasteryBadge status={m.status} />}
                </li>
              );
            })}
          </ul>
        </Card>
        {prereqs.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-navy">Prérequis</h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {prereqs.map((p) => (
                <li key={p.id}>
                  <Link to={`/lecons/${p.id}`} className="text-primary hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {lesson.sources.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-navy">Sources</h2>
            <div className="mt-2 grid gap-1">
              {lesson.sources.map((s) => (
                <SourceTag key={`${s.doc}-${s.pages}`} source={s} />
              ))}
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}
