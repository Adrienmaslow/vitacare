import { db } from '@/db';
import type { DocId } from '@/types';

/** Ouvre un PDF importé localement par l'utilisateur (stocké dans IndexedDB, jamais envoyé). */
export async function openLocalDoc(doc: DocId, page?: number): Promise<boolean> {
  const entry = await db.docs.get(doc);
  if (!entry) return false;
  const url = URL.createObjectURL(entry.blob);
  const win = window.open(page ? `${url}#page=${page}` : url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win !== null || true;
}

export async function saveLocalDoc(doc: DocId, file: File) {
  await db.docs.put({ id: doc, name: file.name, size: file.size, addedAt: Date.now(), blob: file });
}

export async function removeLocalDoc(doc: DocId) {
  await db.docs.delete(doc);
}
