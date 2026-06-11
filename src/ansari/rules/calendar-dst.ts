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
    const baseOffset = tzOffsetMinutes(now, tenant.timezone)
    for (let i = 1; i <= LEAD_DAYS; i++) {
      const day = addDays(now, i)
      const offset = tzOffsetMinutes(day, tenant.timezone)
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
