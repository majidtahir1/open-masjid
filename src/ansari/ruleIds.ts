// src/ansari/ruleIds.ts
export const RULE_IDS = [
  'prayer.coverage_gap',
  'prayer.iqamah_drift',
  'calendar.dst',
  'calendar.ramadan',
  'forms.capacity',
  'announcements.expiring',
  'events.low_rsvp',
  'events.missing_flyer',
  'digest.weekly',
] as const

export type RuleId = (typeof RULE_IDS)[number]
