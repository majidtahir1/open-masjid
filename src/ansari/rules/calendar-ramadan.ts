// src/ansari/rules/calendar-ramadan.ts
import { addDays, hijriParts, localDateISO } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 14

export const calendarRamadan: Rule = {
  id: 'calendar.ramadan',
  category: 'calendar',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    for (let i = 0; i <= LEAD_DAYS; i++) {
      const day = addDays(now, i)
      const h = hijriParts(day, tenant.timezone)
      if (h.month !== 9 || h.day !== 1) continue
      return [
        {
          dedupKey: `ramadan:${h.year}`,
          intent: {
            rule: 'calendar.ramadan',
            startsOn: localDateISO(day, tenant.timezone),
            hijriYear: h.year,
            daysAway: i,
          },
          action: {
            kind: 'conversation-starter',
            topic: 'ramadan-schedule',
            summary: 'Set up the Ramadan prayer schedule',
          },
        },
      ]
    }
    return []
  },
}
