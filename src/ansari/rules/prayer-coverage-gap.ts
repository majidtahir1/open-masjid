// src/ansari/rules/prayer-coverage-gap.ts
import { addDays, endOfNextMonthISO, localDateISO } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 7

export const prayerCoverageGap: Rule = {
  id: 'prayer.coverage_gap',
  category: 'prayer',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const res = await payload.find({
      collection: 'prayer-schedules',
      where: { tenant: { equals: tenant.id } },
      sort: '-endDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const latest = res.docs[0] as { id: string | number; endDate?: string | null } | undefined
    if (!latest?.endDate) return []

    const end = new Date(latest.endDate)
    if (end.getTime() >= addDays(now, LEAD_DAYS).getTime()) return []

    const uncoveredFrom = localDateISO(addDays(end, 1), tenant.timezone)
    const newEndDate = endOfNextMonthISO(end, tenant.timezone)
    return [
      {
        dedupKey: `coverage:${uncoveredFrom.slice(0, 7)}`,
        intent: {
          rule: 'prayer.coverage_gap',
          coveredThrough: latest.endDate,
          uncoveredFrom,
        },
        action: {
          kind: 'direct',
          op: 'extendSchedule',
          params: { scheduleId: latest.id, newEndDate },
          summary: `Extend the prayer schedule through ${newEndDate}`,
        },
      },
    ]
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('coverage_gap action must be direct')
    const { scheduleId, newEndDate } = finding.action.params as {
      scheduleId: string | number
      newEndDate: string
    }
    // payload.update runs collection hooks → autoRegeneratePrayerDays fills days[]
    await ctx.payload.update({
      collection: 'prayer-schedules',
      id: scheduleId,
      data: { endDate: `${newEndDate}T12:00:00.000Z` },
      overrideAccess: true,
    })
    return { ok: true, detail: `Schedule extended through ${newEndDate}` }
  },
}
