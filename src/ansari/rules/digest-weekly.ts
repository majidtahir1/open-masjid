// src/ansari/rules/digest-weekly.ts
import { addDays, isoWeekKey, localParts } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

export const digestWeekly: Rule = {
  id: 'digest.weekly',
  category: 'digest',
  tier: 'digest',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const week = isoWeekKey(now, tenant.timezone)
    const p = localParts(now, tenant.timezone)
    const monthStartUTC = `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`

    const membersTotal = (
      await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).totalDocs

    const membersNewThisMonth = (
      await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenant.id }, createdAt: { greater_than_equal: monthStartUTC } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).totalDocs

    const eventsRes = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, 7).toISOString() },
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const upcomingEvents = (eventsRes.docs as Array<{ title?: string; startDate?: string; flyerImage?: unknown }>).map(
      (e) => ({ title: e.title ?? '', startDate: e.startDate ?? null, hasFlyer: Boolean(e.flyerImage) }),
    )

    // The safety net: unresolved immediate-tier items resurface here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unresolvedRes = await (payload.find as any)({
      collection: 'nudge-states',
      where: {
        tenant: { equals: tenant.id },
        tier: { equals: 'immediate' },
        status: { in: ['emitted', 'delivered', 'snoozed'] },
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
        dedupKey: `digest:${week}`,
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
