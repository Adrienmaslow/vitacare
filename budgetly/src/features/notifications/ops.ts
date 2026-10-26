import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { uuid } from "@/lib/validation";
import { computeAlerts, selectNewAlerts } from "../alerts/engine";
import { loadSnapshot } from "../finance/snapshot";

export const notificationOps = {
  "notifications.list": defineOp({
    name: "notifications.list", mutation: false, input: z.object({ unreadOnly: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(100) }),
    run: async ({ store }, { unreadOnly, limit }) => {
      const rows = await store.list("notifications", { order: { column: "created_at", ascending: false }, limit: 500 });
      const filtered = unreadOnly ? rows.filter((r) => !r.read_at) : rows;
      return { notifications: filtered.slice(0, limit), unread: rows.filter((r) => !r.read_at).length };
    },
  }),

  /**
   * Recalcule les alertes et crée les notifications nouvelles (déduplication + anti-spam).
   * Appelé à l'ouverture de l'application et par la tâche planifiée /api/cron/alerts.
   */
  "alerts.refresh": defineOp({
    name: "alerts.refresh", mutation: true, input: z.object({}),
    run: async ({ store, today }) => {
      const s = await loadSnapshot(store, today);
      const existing = await store.list("notifications", { order: { column: "created_at", ascending: false }, limit: 1000 });
      const sentToday = existing.filter((n) => n.created_at.slice(0, 10) === today).length;
      const fresh = selectNewAlerts(computeAlerts(s), new Set(existing.map((n) => n.dedup_key)), sentToday, s.preferences?.notification_settings ?? {});
      if (!fresh.length) return { created: 0 };
      const rows = await store.upsert(
        "notifications",
        fresh.map((a) => ({ kind: a.kind, title: a.title, body: a.body, priority: a.priority, dedup_key: a.dedupKey, action_label: a.actionLabel, action_href: a.actionHref })),
        ["dedup_key"],
      );
      return { created: rows.length };
    },
  }),

  "notifications.markRead": defineOp({
    name: "notifications.markRead", mutation: true, input: z.object({ ids: z.array(uuid).max(500).optional(), all: z.boolean().optional(), read: z.boolean().default(true) }),
    run: async ({ store, now }, { ids, all, read }) => {
      const target = all ? (await store.list("notifications")).filter((n) => (read ? !n.read_at : !!n.read_at)).map((n) => n.id) : ids ?? [];
      return { updated: await store.updateMany("notifications", target, { read_at: read ? now.toISOString() : null }) };
    },
  }),

  "notifications.delete": defineOp({
    name: "notifications.delete", mutation: true, input: z.object({ ids: z.array(uuid).min(1).max(500) }),
    run: async ({ store }, { ids }) => ({ deleted: await store.remove("notifications", ids) }),
  }),
};
