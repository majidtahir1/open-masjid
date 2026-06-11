// tests/ansari/prayer-coverage-gap.test.ts
import { describe, expect, it, vi } from 'vitest'

import { prayerCoverageGap } from '@/ansari/rules/prayer-coverage-gap'
import { makeCtx, makePayload } from './helpers'

const scheduleEnding = (endDate: string) => ({
  docs: [{ id: 42, endDate }],
  totalDocs: 1,
})

describe('prayer.coverage_gap', () => {
  it('fires when the latest schedule ends within 7 days', async () => {
    const payload = makePayload({
      find: vi.fn(async () => scheduleEnding('2026-06-15T00:00:00.000Z')), // 4 days out
    })
    const findings = await prayerCoverageGap.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('coverage:2026-06')
    expect(findings[0].action).toMatchObject({
      kind: 'direct',
      op: 'extendSchedule',
      params: { scheduleId: 42, newEndDate: '2026-07-31' },
    })
  })

  it('stays silent when coverage extends beyond 7 days', async () => {
    const payload = makePayload({
      find: vi.fn(async () => scheduleEnding('2026-08-01T00:00:00.000Z')),
    })
    expect(await prayerCoverageGap.evaluate(makeCtx(payload))).toEqual([])
  })

  it('stays silent when there is no schedule at all (nothing to extend)', async () => {
    const payload = makePayload()
    expect(await prayerCoverageGap.evaluate(makeCtx(payload))).toEqual([])
  })

  it('execute updates the schedule endDate (regeneration runs via existing hooks)', async () => {
    const payload = makePayload()
    const ctx = makeCtx(payload)
    const [finding] = await (async () => {
      payload.find = vi.fn(async () => scheduleEnding('2026-06-15T00:00:00.000Z'))
      return prayerCoverageGap.evaluate(ctx)
    })()
    await prayerCoverageGap.execute!(ctx, finding)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'prayer-schedules',
        id: 42,
        data: { endDate: '2026-07-31T12:00:00.000Z' },
      }),
    )
  })
})
