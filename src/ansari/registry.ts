// src/ansari/registry.ts
import { announcementsExpiring } from './rules/announcements-expiring'
import { calendarDst } from './rules/calendar-dst'
import { calendarRamadan } from './rules/calendar-ramadan'
import { digestWeekly } from './rules/digest-weekly'
import { eventsLowRsvp } from './rules/events-low-rsvp'
import { eventsMissingFlyer } from './rules/events-missing-flyer'
import { formsCapacity } from './rules/forms-capacity'
import { prayerCoverageGap } from './rules/prayer-coverage-gap'
import { prayerIqamahDrift } from './rules/prayer-iqamah-drift'
import type { Rule } from './types'

export const RULES: Rule[] = [
  prayerCoverageGap,
  prayerIqamahDrift,
  calendarDst,
  calendarRamadan,
  formsCapacity,
  announcementsExpiring,
  eventsLowRsvp,
  eventsMissingFlyer,
  digestWeekly,
]

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id)
}
