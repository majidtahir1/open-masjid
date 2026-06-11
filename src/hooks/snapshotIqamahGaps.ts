// src/hooks/snapshotIqamahGaps.ts
import type { CollectionBeforeChangeHook } from 'payload'

import { iqamahGapMinutes } from '@/lib/iqamah'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

type RuleShape = { mode?: string; absoluteValue?: string | null; gapAtCreation?: number | null }
type DayRow = { date?: string | null } & Record<string, unknown>

/**
 * Records the gap the admin INTENDED when setting an absolute iqamah time:
 * gapAtCreation = iqamah − adhan on the first relevant day at save time.
 * The drift nudge restores this gap instead of guessing a universal target.
 *
 * Must run AFTER autoRegeneratePrayerDays in the beforeChange array so
 * data.days reflects the saved range/rules.
 */
export const snapshotIqamahGaps: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  const rules = data?.iqamahRules as Record<string, RuleShape> | undefined
  if (!rules) return data

  const days = ((data?.days ?? originalDoc?.days) as DayRow[] | undefined) ?? []
  if (days.length === 0) return data

  // UTC date — not tenant-local; ≤1-day refDay skew is acceptable (~minutes of adhan drift).
  const todayISO = new Date().toISOString().slice(0, 10)
  const refDay =
    days.find((d) => typeof d.date === 'string' && d.date.slice(0, 10) >= todayISO) ?? days[0]

  for (const prayer of PRAYERS) {
    const rule = rules[prayer]
    if (!rule || rule.mode !== 'absolute' || !rule.absoluteValue) continue

    const origValue =
      ((originalDoc?.iqamahRules as Record<string, RuleShape> | undefined)?.[prayer]
        ?.absoluteValue as string | null | undefined) ?? null
    const changed = rule.absoluteValue !== origValue
    if (!changed && rule.gapAtCreation != null) continue

    const adhanString =
      ((refDay[prayer] as { adhan?: string | null } | undefined)?.adhan as string) ?? ''
    const gap = iqamahGapMinutes(adhanString, rule.absoluteValue)
    if (gap == null) continue
    rule.gapAtCreation = gap
  }
  return data
}
