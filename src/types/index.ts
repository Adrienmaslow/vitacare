/**
 * Modèles de données d'ECE STUDY.
 * - Le contenu scientifique (Course, Chapter, Lesson, Concept, Formula, Exercise, Question…)
 *   est statique, typé et versionné dans `src/content`.
 * - Les données de l'utilisateur (QuizAttempt, Mistake, UserProgress…) vivent dans IndexedDB.
 */

/* ------------------------------------------------------------------ */
/* Références documentaires                                            */
/* ------------------------------------------------------------------ */

export type DocId = 'cours0' | 'cours1' | 'cours2' | 'livret';

export interface SourceReference {
  doc: DocId;
  /** Pages (diapositives pour les cours, pages imprimées pour le livret). Ex. "12" ou "15-16". */
  pages: string;
  /** Intitulé visible dans le document, quand il existe. */
  label?: string;
}

/** Origine d'un contenu : extrait/reformulé du PDF ou ajout pédagogique d'ECE STUDY. */
export type ContentOrigin = 'pdf' | 'ece-study';

/* ------------------------------------------------------------------ */
/* Structure pédagogique                                               */
/* ------------------------------------------------------------------ */

export type ChapterId = string;
export type TdId = 'TD1' | 'TD2';

export interface Course {
  id: string;
  title: string;
  program: string;
  chapterIds: ChapterId[];
}

export interface Chapter {
  id: ChapterId;
  courseId: string;
  /** Numéro du cours dans le support (0, 1, 2…). */
  number: number;
  title: string;
  shortTitle: string;
  summary: string;
  whyItMatters: string;
  objectives: string[];
  prerequisiteChapterIds: ChapterId[];
  lessonIds: string[];
  tds: TdId[];
  status: 'active' | 'planned';
  source: SourceReference;
}

export type TdRelevance = 'indispensable' | 'utile' | 'culture';

export interface Concept {
  id: string;
  chapterId: ChapterId;
  title: string;
  summary: string;
  prerequisiteIds: string[];
  /** Pertinence effective pour les TD1 et TD2. */
  tdRelevance: TdRelevance;
}

export interface FormulaVariable {
  symbol: string; // LaTeX
  name: string;
  unit: string; // texte, ex. "Ω·m"
}

export interface Formula {
  id: string;
  name: string;
  latex: string;
  meaning: string;
  variables: FormulaVariable[];
  conditions: string;
  intuition: string;
  example?: { statement: string; solution: string };
  pitfalls: string[];
  conceptIds: string[];
  source: SourceReference;
  /** TD dans lesquels la formule est utilisée. */
  usedIn: TdId[];
  /** Variables manipulables dans le simulateur (optionnel). */
  explorer?: FormulaExplorerId;
}

export type FormulaExplorerId = 'resistance' | 'capacitor' | 'mass-action' | 'barrier';

export type VisualId =
  | 'drift'
  | 'resistance-explorer'
  | 'capacitor-explorer'
  | 'band-diagram'
  | 'doping'
  | 'conduction-diffusion'
  | 'pn-junction'
  | 'receptor-convention'
  | 'voltage-divider'
  | 'mass-action';

export type LessonBlock =
  | { kind: 'text'; md: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'formula'; formulaId: string }
  | { kind: 'math'; latex: string }
  | {
      kind: 'callout';
      tone: 'info' | 'warning' | 'limit' | 'erratum' | 'method';
      title: string;
      md: string;
    }
  | { kind: 'example'; title: string; statement: string; steps: string[]; source?: SourceReference }
  | { kind: 'visual'; visual: VisualId; caption: string }
  | { kind: 'check'; questionId: string }
  | { kind: 'heading'; text: string };

export interface Lesson {
  id: string;
  chapterId: ChapterId;
  order: number;
  title: string;
  /** Pourquoi apprendre cette leçon (une phrase). */
  why: string;
  durationMin: number;
  difficulty: Difficulty;
  conceptIds: string[];
  prerequisiteLessonIds: string[];
  blocks: LessonBlock[];
  /** 3 à 5 questions du mode « leçon ». */
  quizQuestionIds: string[];
  sources: SourceReference[];
  /** Cours 0 : fait partie du parcours essentiel (outils directement utiles aux TD1/TD2). */
  essential?: boolean;
  /** Questions du test de validation permettant de « passer » la leçon. */
  skipTestQuestionIds?: string[];
}

export type Difficulty = 1 | 2 | 3;

/* ------------------------------------------------------------------ */
/* Questions et réponses                                               */
/* ------------------------------------------------------------------ */

export interface NumericAnswer {
  value: number;
  /** Unité attendue (syntaxe du moteur d'unités, ex. "Ω", "S/m", "cm^-3"). Vide = sans dimension. */
  unit: string;
  /** Tolérance relative (0.02 = 2 %). */
  tolerance: number;
  /** Si vrai, une réponse sans unité est refusée. */
  unitRequired: boolean;
}

export interface Answer {
  /** Représentation textuelle de la bonne réponse pour l'affichage et l'historique. */
  display: string;
}

export interface ChoiceOption {
  id: string;
  text: string; // peut contenir du LaTeX entre $…$
  /** Pourquoi ce choix est juste/faux. */
  why: string;
}

interface QuestionBase {
  id: string;
  conceptIds: string[];
  difficulty: Difficulty;
  prompt: string;
  explanation: string;
  /** Question directement utile à la réussite des TD. */
  td?: TdId[];
  origin: ContentOrigin;
  source?: SourceReference;
}

export interface McqQuestion extends QuestionBase {
  type: 'mcq' | 'formula';
  choices: ChoiceOption[];
  correctId: string;
}

export interface TrueFalseQuestion extends QuestionBase {
  type: 'truefalse';
  answer: boolean;
}

export interface NumericQuestion extends QuestionBase {
  type: 'numeric';
  answer: NumericAnswer;
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

export interface OrderingQuestion extends QuestionBase {
  type: 'ordering';
  /** Éléments dans le bon ordre. */
  items: string[];
}

export interface SelfCheckQuestion extends QuestionBase {
  type: 'selfcheck';
  modelAnswer: string;
  criteria: string[];
}

export type Question =
  | McqQuestion
  | TrueFalseQuestion
  | NumericQuestion
  | MatchingQuestion
  | OrderingQuestion
  | SelfCheckQuestion;

export type QuestionType = Question['type'];

/** Réponse donnée par l'étudiant, selon le type de question. */
export type GivenAnswer =
  | { type: 'choice'; choiceId: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'text'; value: string }
  | { type: 'matching'; mapping: Record<string, string> }
  | { type: 'ordering'; order: string[] }
  | { type: 'selfcheck'; criteriaMet: boolean[] };

export interface EvaluationResult {
  correct: boolean;
  /** Score partiel entre 0 et 1. */
  score: number;
  feedback: string;
  /** Catégorie d'erreur identifiable de façon fiable, sinon null. */
  errorCategory: ErrorCategory | null;
  expectedDisplay: string;
  givenDisplay: string;
}

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

export type HintLevel = 1 | 2 | 3;

export interface Hint {
  level: HintLevel;
  md: string;
}

export interface CorrectionStep {
  title?: string;
  md: string;
}

export interface ExercisePart {
  /** Numérotation d'origine : AD1.1, Q1.5, ES2.3… */
  id: string;
  prompt: string;
  question: Question;
  hints: [Hint, Hint, Hint];
  correction: CorrectionStep[];
  /** Correction absente du livret : rédigée et calculée par ECE STUDY. */
  correctionOrigin: 'livret' | 'ece-study';
  /** Écart relevé avec le livret (erreur de frappe, calcul, unité…). */
  erratum?: string;
  /** Générateur d'exercice similaire. */
  similarGeneratorId?: string;
}

export type ExerciseSection =
  'Applications directes' | 'Travaux dirigés' | 'Exercices supplémentaires';

export interface Exercise {
  id: string;
  td: TdId;
  section: ExerciseSection;
  /** Numéro d'origine, ex. "1.3". */
  number: string;
  title: string;
  /** Énoncé reformulé fidèlement (données intégralement conservées). */
  statement: string;
  data: { label: string; value: string }[];
  /** Figure du livret nécessaire à la résolution (non reproduite). */
  figure?: { label: string; description: string; page: number };
  objective: string;
  skills: string[];
  prerequisiteLessonIds: string[];
  conceptIds: string[];
  difficulty: Difficulty;
  parts: ExercisePart[];
  source: SourceReference;
  /** Remarques d'audit (données manquantes, ambiguïtés…). */
  auditNotes?: string[];
}

/* ------------------------------------------------------------------ */
/* Flashcards                                                          */
/* ------------------------------------------------------------------ */

export type FlashcardKind =
  'definition' | 'formule' | 'unite' | 'concept' | 'methode' | 'piege' | 'schema';

export interface Flashcard {
  id: string;
  kind: FlashcardKind;
  chapterId: ChapterId;
  conceptIds: string[];
  front: string;
  back: string;
  source?: SourceReference;
}

/* ------------------------------------------------------------------ */
/* Données utilisateur (IndexedDB)                                     */
/* ------------------------------------------------------------------ */

export type ErrorCategory =
  'formule' | 'unites' | 'calcul' | 'signe' | 'methode' | 'comprehension' | 'prerequis';

export type AttemptContext =
  | 'lesson'
  | 'chapter'
  | 'td'
  | 'exam'
  | 'errors'
  | 'quick'
  | 'exercise'
  | 'generated'
  | 'diagnostic'
  | 'skip-test';

export interface QuizAttempt {
  id?: number;
  questionId: string;
  context: AttemptContext;
  /** Identifiant de la ressource (leçon, exercice, session d'examen…). */
  refId: string;
  conceptIds: string[];
  difficulty: Difficulty;
  correct: boolean;
  score: number;
  hintsUsed: number;
  /** Rang de la tentative sur cette question (1 = premier essai). */
  attemptNumber: number;
  given: string;
  expected: string;
  durationMs: number;
  at: number;
}

export interface Mistake {
  id?: number;
  attemptId: number;
  questionId: string;
  context: AttemptContext;
  refId: string;
  label: string;
  conceptIds: string[];
  given: string;
  expected: string;
  category: ErrorCategory | null;
  at: number;
  resolved: boolean;
}

export type LessonStatus = 'a-decouvrir' | 'en-cours' | 'termine' | 'a-revoir';

export interface UserProgress {
  /** id de leçon */
  lessonId: string;
  status: Exclude<LessonStatus, 'a-revoir'>;
  startedAt: number;
  completedAt?: number;
  /** Validée par un test de passage. */
  validatedByTest?: boolean;
}

export interface ExerciseProgress {
  exerciseId: string;
  parts: Record<string, { correct: boolean; hintsUsed: number; correctionViewed: boolean }>;
  updatedAt: number;
}

export type MasteryStatus =
  'non-etudiee' | 'en-apprentissage' | 'a-consolider' | 'maitrisee' | 'a-revoir';

export interface MasteryScore {
  conceptId: string;
  /** 0 à 1 */
  score: number;
  evidence: number;
  status: MasteryStatus;
  lastAt: number | null;
}

export type ReviewGrade = 'a-revoir' | 'difficile' | 'moyen' | 'facile';

export interface RevisionSchedule {
  cardId: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  /** Date d'échéance (YYYY-MM-DD, heure locale). */
  due: string;
  lastReviewedAt: number | null;
  lastGrade: ReviewGrade | null;
}

export interface LearningSession {
  id?: number;
  /** Jour local YYYY-MM-DD */
  day: string;
  startedAt: number;
  lastActiveAt: number;
  activeMs: number;
}

export interface ExamResult {
  id?: number;
  at: number;
  score20: number;
  correct: number;
  total: number;
  durationMs: number;
  timeLimitMin: number;
  questionIds: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  to: string;
  kind: 'review' | 'lesson' | 'quiz' | 'exercise' | 'flashcards' | 'diagnostic' | 'mistakes';
  minutes: number;
}
