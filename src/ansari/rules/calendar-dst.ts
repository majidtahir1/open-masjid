// src/ansari/rules/calendar-dst.ts
import { addDays, localDateISO, tzOffsetMinutes } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 5

export const calendarDst: Rule = {
  id: 'calendar.dst',
  category: 'calendar',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    // Pin offset probes to noon-UTC of each LOCAL date label so the dedupKey
    // is hour-independent (same result whether we poll at 06:00Z or 17:00Z).
    // Date accuracy is ±1 day near the actual transition hour, which is
    // acceptable for a 5-day-lead conversation-starter.
    const probeOffset = (d: Date) =>
      tzOffsetMinutes(new Date(`${localDateISO(d, tenant.timezone)}T12:00:00Z`), tenant.timezone)
    const baseOffset = probeOffset(now)
    for (let i = 1; i <= LEAD_DAYS; i++) {
      const day = addDays(now, i)
      const offset = probeOffset(day)
      if (offset === baseOffset) continue
      const transitionDate = localDateISO(day, tenant.timezone)
      return [
        {
          dedupKey: `dst:${transitionDate}`,
          intent: {
            rule: 'calendar.dst',
            transitionDate,
            direction: offset > baseOffset ? 'forward' : 'back',
            shiftMinutes: offset - baseOffset,
          },
          action: {
            kind: 'conversation-starter',
            topic: 'dst-review',
            summary: 'Review Fajr & Isha iqamah times around the clock change',
          },
        },
      ]
    }
    return []
  },
}
