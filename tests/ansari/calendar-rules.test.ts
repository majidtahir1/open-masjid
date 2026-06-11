// tests/ansari/calendar-rules.test.ts
import { describe, expect, it } from 'vitest'

import { calendarDst } from '@/ansari/rules/calendar-dst'
import { calendarRamadan } from '@/ansari/rules/calendar-ramadan'
import { makeCtx, makePayload } from './helpers'

describe('calendar.dst', () => {
  it('fires when a US fall-back transition is within 5 days', async () => {
    // US DST ends Sun 2026-11-01 (America/Chicago). Oct 28 is 4 days before.
    const ctx = makeCtx(makePayload(), { now: '2026-10-28T17:00:00Z' })
    const findings = await calendarDst.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('dst:2026-11-01')
    expect(findings[0].intent).toMatchObject({ direction: 'back' })
    expect(findings[0].action.kind).toBe('conversation-starter')
  })

  it('fires forward for the spring transition (2026-03-08)', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-03-04T18:00:00Z' })
    const findings = await calendarDst.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('dst:2026-03-08')
    expect(findings[0].intent).toMatchObject({ direction: 'forward' })
  })

  it('is silent mid-season', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-06-11T17:00:00Z' })
    expect(await calendarDst.evaluate(ctx)).toEqual([])
  })
})

describe('calendar.ramadan', () => {
  it('fires once when 1 Ramadan is within 14 days, keyed by hijri year', async () => {
    // Ramadan 1447 begins ~2026-02-17 (umalqura). Scan from Feb 10.
    const ctx = makeCtx(makePayload(), { now: '2026-02-10T18:00:00Z' })
    const findings = await calendarRamadan.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('ramadan:1447')
    expect(findings[0].action).toMatchObject({ kind: 'conversation-starter', topic: 'ramadan-schedule' })
  })

  it('is silent months away from Ramadan', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-06-11T17:00:00Z' })
    expect(await calendarRamadan.evaluate(ctx)).toEqual([])
  })
})
