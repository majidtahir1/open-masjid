// tests/ansari/pipeline.test.ts
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS, inDigestWindow, inQuietHours, runNudgePipeline } from '@/ansari/pipeline'

const CHI = 'America/Chicago'
// Thursday 2026-06-11 12:00 Chicago — inside allowed hours, not a digest window
const NOON = new Date('2026-06-11T17:00:00Z')
// Thursday 2026-06-11 23:00 Chicago — inside quiet hours (21→8)
const NIGHT = new Date('2026-06-12T04:00:00Z')
// Sunday 2026-06-14 10:00 Chicago — digest window (Sunday, hour >= 9)
const SUNDAY = new Date('2026-06-14T15:00:00Z')

function db(opts: {
  schedules?: object[]
  states?: object[]
  settings?: object[]
} = {}) {
  const created: Record<string, unknown>[] = []
  const updated: Array<{ id: unknown; data: Record<string, unknown> }> = []
  let nextId = 100
  const payload = {
    findByID: vi.fn(async () => ({ id: 7, location: { timezone: CHI } })),
    find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'ansari-settings') return { docs: opts.settings ?? [], totalDocs: 0 }
      if (collection === 'prayer-schedules') return { docs: opts.schedules ?? [], totalDocs: 0 }
      if (collection === 'nudge-states') {
        const allStates = opts.states ?? []
        // Filter by where clause to mirror real DB behaviour.
        const filtered = allStates.filter((s) => {
          const doc = s as Record<string, unknown>
          // Filter out docs that already have resolvedAt set.
          if (doc.resolvedAt != null) return false
          // Filter by status in-list if provided.
          const statusIn = (where as Record<string, { in?: string[] }>)?.status?.in
          if (statusIn && !statusIn.includes(doc.status as string)) return false
          return true
        })
        return { docs: filtered, totalDocs: filtered.length }
      }
      return { docs: [], totalDocs: 0 }
    }),
    count: vi.fn(async () => ({ totalDocs: 0 })),
    create: vi.fn(async (a: { data: Record<string, unknown> }) => {
      const doc = { id: nextId++, ...a.data }
      created.push(doc)
      return doc
    }),
    update: vi.fn(async (a: { id: unknown; data: Record<string, unknown> }) => {
      updated.push(a)
      return a.data
    }),
    logger: { error: vi.fn(), warn: vi.fn() },
  }
  return { payload: payload as never, created, updated }
}

// One real firing rule is enough to exercise the machinery: a schedule ending
// in 4 days makes prayer.coverage_gap fire with dedupKey 'coverage:2026-06'.
const FIRING_SCHEDULE = [{ id: 42, endDate: '2026-06-15T00:00:00.000Z' }]

describe('window predicates', () => {
  it('inQuietHours wraps midnight (21→8)', () => {
    expect(inQuietHours(NIGHT, CHI, DEFAULT_SETTINGS)).toBe(true)
    expect(inQuietHours(NOON, CHI, DEFAULT_SETTINGS)).toBe(false)
  })
  it('inDigestWindow = digest day, at-or-after digest hour', () => {
    expect(inDigestWindow(SUNDAY, CHI, DEFAULT_SETTINGS)).toBe(true)
    expect(inDigestWindow(NOON, CHI, DEFAULT_SETTINGS)).toBe(false)
  })
})

describe('runNudgePipeline', () => {
  it('emits a new immediate finding and records it as emitted', async () => {
    const { payload, created } = db({ schedules: FIRING_SCHEDULE })
    const out = await runNudgePipeline(payload, 7, NOON)
    const coverage = out.find((n) => n.rule === 'prayer.coverage_gap')
    expect(coverage).toBeDefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toMatchObject({ status: 'emitted' })
  })

  it('holds immediates during quiet hours without recording state', async () => {
    const { payload, created } = db({ schedules: FIRING_SCHEDULE })
    const out = await runNudgePipeline(payload, 7, NIGHT)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toBeUndefined()
  })

  it('re-emits an emitted-but-unacked state instead of creating a duplicate', async () => {
    const { payload, created } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'emitted', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    const coverage = out.filter((n) => n.rule === 'prayer.coverage_gap')
    expect(coverage).toHaveLength(1)
    expect(coverage[0].id).toBe(55)
    expect(created).toHaveLength(0)
  })

  it('stays silent for delivered-and-unresolved (fire once per problem)', async () => {
    const { payload } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
  })

  it('resolution sweep: marks states resolved when their problem stopped firing', async () => {
    const { payload, updated } = db({
      schedules: [{ id: 42, endDate: '2026-09-15T00:00:00.000Z' }], // gap fixed
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
    })
    await runNudgePipeline(payload, 7, NOON)
    expect(updated.find((u) => u.id === 55)?.data).toMatchObject({ status: 'resolved' })
  })

  it('emits the weekly digest only in the digest window', async () => {
    const quiet = db({})
    expect((await runNudgePipeline(quiet.payload, 7, NOON)).find((n) => n.rule === 'digest.weekly')).toBeUndefined()
    const sunday = db({})
    const out = await runNudgePipeline(sunday.payload, 7, SUNDAY)
    expect(out.find((n) => n.rule === 'digest.weekly')).toBeDefined()
  })

  it('respects disabled rules and the master toggle', async () => {
    const disabled = db({
      schedules: FIRING_SCHEDULE,
      settings: [{ enabled: true, disabledRules: ['prayer.coverage_gap'] }],
    })
    expect((await runNudgePipeline(disabled.payload, 7, NOON)).find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()

    const off = db({ schedules: FIRING_SCHEDULE, settings: [{ enabled: false }] })
    expect(await runNudgePipeline(off.payload, 7, NOON)).toEqual([])
  })

  it('invalid tenant timezone falls back to UTC without throwing', async () => {
    // tenant doc has an invalid tz — pipeline must resolve and use UTC gating instead
    const { payload } = db({ schedules: FIRING_SCHEDULE })
    // Override findByID to return a tenant with an invalid timezone
    ;(payload as { findByID: ReturnType<typeof vi.fn> }).findByID = vi.fn(
      async () => ({ id: 7, location: { timezone: 'Not/AZone' } }),
    )
    // NOON UTC is 12:00 UTC — outside default quiet hours (21→8) in UTC too,
    // so the coverage_gap rule should still fire and the result is defined.
    const out = await runNudgePipeline(payload, 7, NOON)
    expect(out).toBeDefined()
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeDefined()
  })

  // Fix 1: throwing rule must not false-resolve its states
  it('throwing rule does not resolve its existing state', async () => {
    const { payload, updated } = db({
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
    })
    // Make prayer-schedules throw so prayer.coverage_gap rule errors.
    ;(payload as { find: ReturnType<typeof vi.fn> }).find = vi.fn(
      async ({ collection }: { collection: string }) => {
        if (collection === 'prayer-schedules') throw new Error('DB connection failed')
        if (collection === 'ansari-settings') return { docs: [], totalDocs: 0 }
        if (collection === 'nudge-states')
          return {
            docs: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
            totalDocs: 1,
          }
        return { docs: [], totalDocs: 0 }
      },
    )
    // Pipeline must still resolve (not throw).
    await expect(runNudgePipeline(payload, 7, NOON)).resolves.toBeDefined()
    // State 55 must NOT be marked resolved.
    expect(updated.find((u) => u.id === 55)).toBeUndefined()
    // logger.error must have been called with the failed rule.
    const loggerError = (payload as unknown as { logger: { error: ReturnType<typeof vi.fn> } }).logger.error
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ rule: 'prayer.coverage_gap', tenant: 7 }),
      'nudge rule evaluation failed',
    )
  })

  // Fix 2a: dismissed state suppresses output and creation while problem persists
  it('dismissed state suppresses re-creation while problem persists', async () => {
    const { payload, created } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'dismissed', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toBeUndefined()
  })

  // Fix 2b: dismissed + condition gone → update with resolvedAt only (no status change)
  it('dismissed + condition gone: stamps resolvedAt without changing status', async () => {
    const { payload, updated } = db({
      schedules: [{ id: 42, endDate: '2026-09-15T00:00:00.000Z' }], // gap fixed
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'dismissed', tier: 'immediate' }],
    })
    await runNudgePipeline(payload, 7, NOON)
    const update = updated.find((u) => u.id === 55)
    expect(update).toBeDefined()
    expect(update?.data).toHaveProperty('resolvedAt')
    expect(update?.data).not.toHaveProperty('status')
  })

  // Fix 2c: snoozed state stays silent at noon
  it('snoozed state stays silent during allowed hours (no emit, no create)', async () => {
    const { payload, created } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'snoozed', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toBeUndefined()
  })

  // Fix 2d: emitted state suppressed during quiet hours (no emit, no create)
  it('emitted state suppressed during quiet hours', async () => {
    const { payload, created } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'emitted', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NIGHT)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
    expect(created).toHaveLength(0)
  })

  // Fix 2e: stale digest week → resolve with status change
  it('stale digest week: resolves with status=resolved', async () => {
    const { payload, updated } = db({
      states: [{ id: 60, rule: 'digest.weekly', dedupKey: 'digest:2026-W23', status: 'delivered', tier: 'digest' }],
    })
    await runNudgePipeline(payload, 7, NOON)
    const update = updated.find((u) => u.id === 60)
    expect(update?.data).toMatchObject({ status: 'resolved' })
    expect(update?.data).toHaveProperty('resolvedAt')
  })

  // Fix 3: duplicate heal — two emitted states same dedupKey
  it('heals duplicate open states: keeps smallest id, resolves the other', async () => {
    const { payload, updated } = db({
      schedules: FIRING_SCHEDULE,
      states: [
        { id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'emitted', tier: 'immediate' },
        { id: 56, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'emitted', tier: 'immediate' },
      ],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    const coverageOut = out.filter((n) => n.rule === 'prayer.coverage_gap')
    expect(coverageOut).toHaveLength(1)
    expect(coverageOut[0].id).toBe(55)
    // id 56 should have been healed (resolved)
    const healUpdate = updated.find((u) => u.id === 56)
    expect(healUpdate?.data).toMatchObject({ status: 'resolved' })
  })
})
