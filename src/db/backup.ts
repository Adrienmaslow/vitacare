import { db, EXPORTED_TABLES, type ExportedTable } from './index';

/**
 * Export / import JSON versionné.
 * - `formatVersion` décrit la structure du fichier ; un fichier plus ancien est migré à l'import.
 * - Les PDF importés localement ne sont jamais exportés.
 */
export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_APP_ID = 'ece-study';

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  formatVersion: number;
  exportedAt: string;
  settings?: Record<string, unknown>;
  data: Record<ExportedTable, unknown[]>;
}

export async function exportData(settings?: Record<string, unknown>): Promise<ExportFile> {
  const data = {} as Record<ExportedTable, unknown[]>;
  for (const t of EXPORTED_TABLES) data[t] = await db.table(t).toArray();
  return {
    app: EXPORT_APP_ID,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    data,
  };
}

export class ImportError extends Error {}

type Validator = (row: Record<string, unknown>) => boolean;

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown) => typeof v === 'string';
const isBool = (v: unknown) => typeof v === 'boolean';
const isArr = (v: unknown) => Array.isArray(v);

const VALIDATORS: Record<ExportedTable, Validator> = {
  attempts: (r) =>
    isStr(r.questionId) &&
    isStr(r.context) &&
    isNum(r.at) &&
    isBool(r.correct) &&
    isNum(r.score) &&
    isArr(r.conceptIds) &&
    isNum(r.hintsUsed),
  mistakes: (r) => isStr(r.questionId) && isNum(r.at) && isBool(r.resolved) && isArr(r.conceptIds),
  lessonProgress: (r) =>
    isStr(r.lessonId) && (r.status === 'en-cours' || r.status === 'termine') && isNum(r.startedAt),
  exerciseProgress: (r) => isStr(r.exerciseId) && typeof r.parts === 'object' && r.parts !== null,
  reviews: (r) => isStr(r.cardId) && isNum(r.ease) && isNum(r.intervalDays) && isStr(r.due),
  sessions: (r) => isStr(r.day) && isNum(r.activeMs) && isNum(r.startedAt),
  exams: (r) => isNum(r.at) && isNum(r.score20) && isNum(r.total),
  achievements: (r) => isStr(r.id) && isNum(r.unlockedAt),
  meta: (r) => isStr(r.key),
};

/** Migrations de format : formatVersion n → n+1. */
const MIGRATIONS: Record<number, (f: ExportFile) => ExportFile> = {
  // 1: (f) => ({ ...f, formatVersion: 2, data: { ...f.data, nouvelleTable: [] } }),
};

export function validateExport(raw: unknown): ExportFile {
  if (typeof raw !== 'object' || raw === null)
    throw new ImportError('Fichier invalide : JSON attendu.');
  const f = raw as Partial<ExportFile>;
  if (f.app !== EXPORT_APP_ID) throw new ImportError('Ce fichier ne provient pas d’ECE STUDY.');
  if (!isNum(f.formatVersion) || (f.formatVersion as number) < 1)
    throw new ImportError('Version de format absente ou invalide.');
  if ((f.formatVersion as number) > EXPORT_FORMAT_VERSION)
    throw new ImportError(
      'Ce fichier provient d’une version plus récente d’ECE STUDY : mets l’application à jour.',
    );
  let file = f as ExportFile;
  while (file.formatVersion < EXPORT_FORMAT_VERSION) {
    const migrate = MIGRATIONS[file.formatVersion];
    if (!migrate)
      throw new ImportError(`Migration manquante depuis la version ${file.formatVersion}.`);
    file = migrate(file);
  }
  if (typeof file.data !== 'object' || file.data === null)
    throw new ImportError('Section « data » manquante.');
  for (const t of EXPORTED_TABLES) {
    const rows = file.data[t] ?? [];
    if (!Array.isArray(rows)) throw new ImportError(`Table « ${t} » invalide.`);
    rows.forEach((row, i) => {
      if (typeof row !== 'object' || row === null || !VALIDATORS[t](row as Record<string, unknown>))
        throw new ImportError(`Entrée ${i + 1} de « ${t} » invalide.`);
    });
  }
  return file;
}

/** Remplace toutes les données locales par celles du fichier (transaction unique). */
export async function importData(
  raw: unknown,
): Promise<{ file: ExportFile; counts: Record<string, number> }> {
  const file = validateExport(raw);
  const counts: Record<string, number> = {};
  await db.transaction(
    'rw',
    EXPORTED_TABLES.map((t) => db.table(t)),
    async () => {
      for (const t of EXPORTED_TABLES) {
        const table = db.table(t);
        await table.clear();
        const rows = file.data[t] ?? [];
        if (rows.length) await table.bulkPut(rows);
        counts[t] = rows.length;
      }
    },
  );
  return { file, counts };
}
