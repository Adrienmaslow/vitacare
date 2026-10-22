import Dexie, { type EntityTable } from 'dexie';
import type {
  Achievement,
  ExamResult,
  ExerciseProgress,
  LearningSession,
  Mistake,
  QuizAttempt,
  RevisionSchedule,
  UserProgress,
} from '@/types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

/** Document de cours importé localement par l'utilisateur (jamais exporté ni envoyé). */
export interface LocalDoc {
  id: string; // 'cours0' | 'cours1' | 'cours2' | 'livret'
  name: string;
  size: number;
  addedAt: number;
  blob: Blob;
}

export type StoredAchievement = Required<Pick<Achievement, 'id' | 'unlockedAt'>>;

/**
 * Base locale IndexedDB.
 * Migrations : chaque évolution du schéma ajoute un `this.version(n+1).stores({...}).upgrade(...)`
 * sans jamais modifier les versions précédentes (voir docs/ARCHITECTURE.md).
 */
export class EceStudyDB extends Dexie {
  attempts!: EntityTable<QuizAttempt, 'id'>;
  mistakes!: EntityTable<Mistake, 'id'>;
  lessonProgress!: EntityTable<UserProgress, 'lessonId'>;
  exerciseProgress!: EntityTable<ExerciseProgress, 'exerciseId'>;
  reviews!: EntityTable<RevisionSchedule, 'cardId'>;
  sessions!: EntityTable<LearningSession, 'id'>;
  exams!: EntityTable<ExamResult, 'id'>;
  achievements!: EntityTable<StoredAchievement, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  docs!: EntityTable<LocalDoc, 'id'>;

  constructor(name = 'ece-study') {
    super(name);
    this.version(1).stores({
      attempts: '++id, questionId, context, refId, at, *conceptIds',
      mistakes: '++id, questionId, at, resolved, category, *conceptIds',
      lessonProgress: 'lessonId, status',
      exerciseProgress: 'exerciseId, updatedAt',
      reviews: 'cardId, due',
      sessions: '++id, day, lastActiveAt',
      exams: '++id, at',
      achievements: 'id',
      meta: 'key',
      docs: 'id',
    });
  }
}

export const db = new EceStudyDB();

/** Tables incluses dans l'export JSON (les PDF locaux en sont exclus). */
export const EXPORTED_TABLES = [
  'attempts',
  'mistakes',
  'lessonProgress',
  'exerciseProgress',
  'reviews',
  'sessions',
  'exams',
  'achievements',
  'meta',
] as const;

export type ExportedTable = (typeof EXPORTED_TABLES)[number];
