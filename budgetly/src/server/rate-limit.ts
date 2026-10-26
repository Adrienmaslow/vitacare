/**
 * Limitation de débit en mémoire (fenêtre glissante par clé).
 * Limite : par instance serveur. En production multi-instances, remplacer par un
 * stockage partagé (ex. Upstash Redis) — voir docs/SECURITY.md.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterMs: windowMs - (now - hits[0]!) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterMs: 0 };
}

export const LIMITS = {
  default: { limit: 120, windowMs: 60_000 },
  sensitive: { limit: 10, windowMs: 60_000 },
} as const;
