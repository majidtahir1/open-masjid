// src/ansari/rules/digest-weekly.ts
import { addDays, isoWeekKey, localParts } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

/** Canonical dedup key for the current week's digest. Used by the rule AND the pipeline stale-digest check. */
export function digestDedupKey(now: Date, timezone: string): string {
  return `digest:${isoWeekKey(now, timezone)}`
}

export const digestWeekly: Rule = {
  id: 'digest.weekly',
  category: 'digest',
  tier: 'digest',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const week = isoWeekKey(now, tenant.timezone)
    const p = localParts(now, tenant.timezone)
    // UTC midnight of the 1st is used as an approximation of the tenant-local month start;
    // off by the tz offset (up to ±14 h) — acceptable for a digest stat.
    const monthStartUTC = `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`

    const { totalDocs: membersTotal } = await payload.count({
      collection: 'members',
      where: { tenant: { equals: tenant.id } },
      overrideAccess: true,
    })

    const { totalDocs: membersNewThisMonth } = await payload.count({
      collection: 'members',
      where: { tenant: { equals: tenant.id }, createdAt: { greater_than_equal: monthStartUTC } },
      overrideAccess: true,
    })

    const eventsRes = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        _status: { equals: 'published' },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, 7).toISOString() },
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const upcomingEvents = (eventsRes.docs as Array<{ title?: string; startDate?: string; flyerImage?: unknown }>).map(
      (e) => ({ title: e.title ?? '', startDate: e.startDate ?? null, hasFlyer: Boolean(e.flyerImage) }),
    )

    // The safety net: unresolved items resurface here — immediates plus
    // snoozed/undelivered digest-tier nudges (which otherwise stay suppressed
    // until their condition changes). Dismissed ([No]) stays dismissed, and the
    // digest's own state is excluded so it never lists itself.
    const unresolvedRes = await payload.find({
      collection: 'nudge-states',
      where: {
        tenant: { equals: tenant.id },
        rule: { not_equals: 'digest.weekly' },
        status: { in: ['emitted', 'delivered', 'snoozed'] },
        resolvedAt: { exists: false },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const unresolved = (unresolvedRes.docs as unknown as Array<{ id: string | number; rule: string; status: string; intent?: unknown }>).map(
      (s) => ({ id: s.id, rule: s.rule, status: s.status, intent: s.intent ?? null }),
    )

    return [
      {
        dedupKey: digestDedupKey(now, tenant.timezone),
        // Exact figures travel in the intent — Hermes templates them verbatim,
        // the LLM writes only connective prose (hard guard, see spec).
        intent: {
          rule: 'digest.weekly',
          week,
          stats: { membersTotal, membersNewThisMonth },
          upcomingEvents,
          unresolved,
        },
        action: {
          kind: 'conversation-starter',
          topic: 'weekly-digest',
          summary: 'Want me to handle any of it?',
        },
      },
    ]
  },
}
