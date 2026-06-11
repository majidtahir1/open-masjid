// src/ansari/rules/prayer-iqamah-drift.ts
import { formatTime, parseTime } from '@/lib/iqamah'
import { addDays, localDateISO } from '@/ansari/time'
import type { Finding, NudgeContext, Rule } from '@/ansari/types'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const
const FLOOR_MIN = 5
const TOLERANCE_MIN = 10
const LOOKAHEAD_DAYS = 14

type DayRow = { date?: string | null } & Record<string, unknown>
type RuleShape = { mode?: string; absoluteValue?: string | null; gapAtCreation?: number | null }
type ScheduleDoc = {
  id: string | number
  iqamahRules?: Record<string, RuleShape>
  days?: DayRow[]
}

async function activeSchedule(ctx: NudgeContext): Promise<ScheduleDoc | null> {
  const { payload, tenant, now } = ctx
  const dayFloor = `${localDateISO(now, tenant.timezone)}T00:00:00.000Z`
  const res = await payload.find({
    collection: 'prayer-schedules',
    where: {
      tenant: { equals: tenant.id },
      startDate: { less_than_equal: now.toISOString() },
      endDate: { greater_than_equal: dayFloor },
    },
    sort: '-startDate',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as ScheduleDoc) ?? null
}

/**
 * Gap from adhan to iqamah, centered to [-720, 720) so a midnight-crossing
 * 30-min gap (adhan 11:45 PM, iqamah 12:15 AM) reads +30, while an iqamah a
 * few minutes BEFORE adhan reads slightly negative (floor breach).
 */
function prayerGap(day: DayRow, prayer: string): number | null {
  const cell = day[prayer] as { adhan?: string | null; iqamah?: string | null } | undefined
  const adhan = parseTime(cell?.adhan ?? '')
  const iqamah = parseTime(cell?.iqamah ?? '')
  if (adhan == null || iqamah == null) return null
  // Centered to [-720, 720): a midnight-crossing 30-min gap reads +30, while an
  // iqamah a few minutes BEFORE adhan reads slightly negative (floor breach).
  return ((((iqamah - adhan + 720) % 1440) + 1440) % 1440) - 720
}

export const prayerIqamahDrift: Rule = {
  id: 'prayer.iqamah_drift',
  category: 'prayer',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    const schedule = await activeSchedule(ctx)
    if (!schedule) return []

    const todayKey = localDateISO(now, tenant.timezone)
    const horizonKey = localDateISO(addDays(now, LOOKAHEAD_DAYS), tenant.timezone)
    const windowDays = (schedule.days ?? []).filter((d) => {
      const key = typeof d.date === 'string' ? d.date.slice(0, 10) : ''
      return key >= todayKey && key <= horizonKey
    })
    if (windowDays.length === 0) return []

    const findings: Finding[] = []
    for (const prayer of PRAYERS) {
      const rule = schedule.iqamahRules?.[prayer]
      if (rule?.mode !== 'absolute' || !rule.absoluteValue) continue

      // Intended gap: the snapshot if present, else the gap on the first
      // lookahead day (pure fallback for pre-snapshot rules — see spec).
      const intendedGap = rule.gapAtCreation ?? prayerGap(windowDays[0], prayer)
      if (intendedGap == null) continue

      for (const d of windowDays) {
        const gap = prayerGap(d, prayer)
        if (gap == null) continue
        const breach =
          gap < FLOOR_MIN ? 'floor' : Math.abs(gap - intendedGap) > TOLERANCE_MIN ? 'drift' : null
        if (!breach) continue

        const adhanThatDay = (d[prayer] as { adhan?: string }).adhan ?? ''
        const proposed = formatTime((parseTime(adhanThatDay) ?? 0) + Math.max(intendedGap, FLOOR_MIN))
        findings.push({
          dedupKey: `iqamah:${prayer}:${breach}`,
          intent: {
            rule: 'prayer.iqamah_drift',
            prayer,
            breach,
            firstBreachDate: typeof d.date === 'string' ? d.date.slice(0, 10) : null,
            currentIqamah: rule.absoluteValue,
            gapMinutes: gap,
            intendedGapMinutes: intendedGap,
          },
          action: {
            kind: 'direct',
            op: 'setAbsoluteIqamah',
            params: { scheduleId: schedule.id, prayer, value: proposed },
            summary: `Move ${prayer} iqamah to ${proposed} (restores the ${intendedGap}-min gap)`,
          },
        })
        break // earliest breach per prayer only
      }
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('iqamah_drift action must be direct')
    const { scheduleId, prayer, value } = finding.action.params as {
      scheduleId: string | number
      prayer: string
      value: string
    }
    const doc = (await ctx.payload.findByID({
      collection: 'prayer-schedules',
      id: scheduleId,
      depth: 0,
      overrideAccess: true,
    })) as ScheduleDoc
    const rules = { ...(doc.iqamahRules ?? {}) }
    rules[prayer] = { ...rules[prayer], mode: 'absolute', absoluteValue: value }
    // Hooks re-apply rules to days[] and re-snapshot gapAtCreation.
    await ctx.payload.update({
      collection: 'prayer-schedules',
      id: scheduleId,
      data: { iqamahRules: rules },
      overrideAccess: true,
    })
    return { ok: true, detail: `${prayer} iqamah moved to ${value}` }
  },
}
