// tests/ansari/prayer-iqamah-drift.test.ts
import { describe, expect, it, vi } from 'vitest'

import { prayerIqamahDrift } from '@/ansari/rules/prayer-iqamah-drift'
import { makeCtx, makePayload } from './helpers'

// Build a schedule whose fajr adhan advances `advanceMinPerDay` minutes per day
// from a base of 5:00 AM, with a fixed absolute fajr iqamah.
function schedule(opts: {
  absolute: string
  gapAtCreation?: number | null
  advanceMinPerDay?: number
  daysCount?: number
}) {
  const { absolute, gapAtCreation = null, advanceMinPerDay = 0, daysCount = 20 } = opts
  const days = Array.from({ length: daysCount }, (_, i) => {
    const totalMin = 5 * 60 + i * advanceMinPerDay // base 5:00 AM
    const h24 = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    const adhan = `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
    const date = new Date(Date.UTC(2026, 5, 11 + i)).toISOString() // 2026-06-11 + i
    return {
      date,
      fajr: { adhan, iqamah: absolute },
      zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
      asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
      maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
      isha: { adhan: '10:00 PM', iqamah: '10:15 PM' },
    }
  })
  return {
    docs: [
      {
        id: 9,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-07-15T00:00:00.000Z',
        iqamahRules: {
          fajr: { mode: 'absolute', absoluteValue: absolute, gapAtCreation },
          zuhr: { mode: 'offset', offsetMinutes: 15 },
          asr: { mode: 'offset', offsetMinutes: 15 },
          maghrib: { mode: 'offset', offsetMinutes: 5 },
          isha: { mode: 'offset', offsetMinutes: 15 },
        },
        days,
      },
    ],
    totalDocs: 1,
  }
}

describe('prayer.iqamah_drift', () => {
  it('fires a floor breach when iqamah falls within 5 min of adhan inside 14 days', async () => {
    // adhan starts 5:00 AM advancing 3 min/day; iqamah fixed 5:10 AM, intended gap 10.
    // Day 2: adhan 5:06 → gap 4 (< 5) → floor breach fires BEFORE the ±10 drift
    // tolerance would (day 4) — intended gap must be small for floor to win.
    // proposed = adhan(day2) + max(intendedGap, FLOOR_MIN) = 5:06 + 10 = 5:16 AM
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:10 AM', gapAtCreation: 10, advanceMinPerDay: 3 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('iqamah:fajr:floor')
    expect(findings[0].intent).toMatchObject({ prayer: 'fajr', breach: 'floor' })
    expect(findings[0].action).toMatchObject({ kind: 'direct', op: 'setAbsoluteIqamah' })
    expect((findings[0].action as { params?: { value?: string } }).params?.value).toBe('5:16 AM')
  })

  it('frames findings in masjid-admin language, free of engine jargon', async () => {
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:10 AM', gapAtCreation: 10, advanceMinPerDay: 3 })),
    })
    const [finding] = await prayerIqamahDrift.evaluate(makeCtx(payload))
    const intent = finding.intent as { problem?: string; prayerLabel?: string }
    const summary = (finding.action as { summary?: string }).summary ?? ''
    // admin-friendly framing present
    expect(intent.prayerLabel).toBe('Fajr')
    expect(intent.problem).toMatch(/congregation|gather/i)
    expect(summary).toMatch(/gap after the adhan/i)
    // no engine vocabulary leaks into the prose the admin will see
    const adminFacing = `${intent.problem} ${summary}`
    expect(adminFacing).not.toMatch(/\bdrift\b|\bfloor\b|\bbreach\b|prayer\.iqamah_drift/i)
  })

  it('fires a drift breach when the gap strays more than ±10 min from gapAtCreation', async () => {
    // base 5:00 + 2/day, iqamah 5:45, intended 45 → day i gap = 45 − 2i;
    // day 6: gap 33, |33 − 45| = 12 > 10 → drift (still ≥ 5, so not floor)
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: 45, advanceMinPerDay: 2 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('iqamah:fajr:drift')
  })

  it('falls back to the schedule first day gap when no snapshot exists (constant adhan → silent)', async () => {
    // No gapAtCreation: intended = schedule day-0 gap (stable anchor).
    // Constant adhan → gap never drifts, no floor → silent.
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: null, advanceMinPerDay: 0 })),
    })
    expect(await prayerIqamahDrift.evaluate(makeCtx(payload))).toEqual([])
  })

  it('ignores offset-mode prayers entirely', async () => {
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: 45, advanceMinPerDay: 0 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings.every((f) => (f.intent as { prayer?: string }).prayer === 'fajr')).toBe(true)
  })

  it('execute rewrites the absolute value via iqamahRules update', async () => {
    const sched = schedule({ absolute: '5:20 AM', gapAtCreation: 20, advanceMinPerDay: 3 })
    const payload = makePayload({
      find: vi.fn(async () => sched),
      findByID: vi.fn(async () => sched.docs[0]),
    })
    const ctx = makeCtx(payload)
    const [finding] = await prayerIqamahDrift.evaluate(ctx)
    await prayerIqamahDrift.execute!(ctx, finding)
    const call = payload.update.mock.calls[0][0]
    expect(call.collection).toBe('prayer-schedules')
    expect(call.id).toBe(9)
    expect(call.data.iqamahRules.fajr.mode).toBe('absolute')
    expect(call.data.iqamahRules.fajr.absoluteValue).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
  })

  it('same-day floor-beats-drift: gapAtCreation 20, adhan 5:00 AM, iqamah 5:02 AM → gap 2 → floor wins', async () => {
    // gap = 2 < FLOOR_MIN(5) → floor breach on day 0.
    // Also: |2 − 20| = 18 > TOLERANCE(10) → drift would also fire, but floor is checked first.
    // proposed = 5:00 AM adhan (300 min) + max(20, 5) = 320 min = 5:20 AM
    const days = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 5, 11 + i)).toISOString(),
      fajr: { adhan: '5:00 AM', iqamah: '5:02 AM' },
      zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
      asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
      maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
      isha: { adhan: '10:00 PM', iqamah: '10:15 PM' },
    }))
    const sched = {
      docs: [
        {
          id: 77,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-07-15T00:00:00.000Z',
          iqamahRules: {
            fajr: { mode: 'absolute', absoluteValue: '5:02 AM', gapAtCreation: 20 },
            zuhr: { mode: 'offset', offsetMinutes: 15 },
            asr: { mode: 'offset', offsetMinutes: 15 },
            maghrib: { mode: 'offset', offsetMinutes: 5 },
            isha: { mode: 'offset', offsetMinutes: 15 },
          },
          days,
        },
      ],
      totalDocs: 1,
    }
    const payload = makePayload({ find: vi.fn(async () => sched) })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('iqamah:fajr:floor')
    expect((findings[0].action as { params?: { value?: string } }).params?.value).toBe('5:20 AM')
  })

  it('midnight-crossing iqamah: isha adhan 11:45 PM, iqamah 12:15 AM reads +30, no breach', async () => {
    // gapAtCreation = 30, no drift, gap stays +30 all days → silent
    const days = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 5, 11 + i)).toISOString(),
      fajr: { adhan: '5:00 AM', iqamah: '5:15 AM' },
      zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
      asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
      maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
      isha: { adhan: '11:45 PM', iqamah: '12:15 AM' },
    }))
    const midnightSchedule = {
      docs: [
        {
          id: 99,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-07-15T00:00:00.000Z',
          iqamahRules: {
            fajr: { mode: 'offset', offsetMinutes: 15 },
            zuhr: { mode: 'offset', offsetMinutes: 15 },
            asr: { mode: 'offset', offsetMinutes: 15 },
            maghrib: { mode: 'offset', offsetMinutes: 5 },
            isha: { mode: 'absolute', absoluteValue: '12:15 AM', gapAtCreation: 30 },
          },
          days,
        },
      ],
      totalDocs: 1,
    }
    const payload = makePayload({
      find: vi.fn(async () => midnightSchedule),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    // gap = +30 (midnight-safe), no floor (30 >= 5), no drift (|30 - 30| = 0 <= 10) → silent
    expect(findings).toEqual([])
  })
})
